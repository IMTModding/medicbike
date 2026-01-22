import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DbSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type FcmTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: string;
};

type PushTargetSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function uint8ArrayToUrlBase64(uint8Array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidKeyPairFromBase64Url(publicKeyBase64: string, privateKeyBase64: string): Promise<CryptoKeyPair> {
  const publicRaw = urlBase64ToUint8Array(publicKeyBase64);
  const publicBytes = publicRaw.length === 64 ? new Uint8Array([0x04, ...publicRaw]) : publicRaw;

  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) {
    throw new Error(`Invalid VAPID public key length/format: ${publicBytes.length}`);
  }

  const x = publicBytes.slice(1, 33);
  const y = publicBytes.slice(33, 65);

  const d = urlBase64ToUint8Array(privateKeyBase64);
  if (d.length !== 32) {
    throw new Error(`Invalid VAPID private key length: ${d.length}`);
  }

  const publicJwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToUrlBase64(x),
    y: uint8ArrayToUrlBase64(y),
    ext: true,
    key_ops: ["verify"],
  };

  const privateJwk: JsonWebKey = {
    ...publicJwk,
    d: uint8ArrayToUrlBase64(d),
    key_ops: ["sign"],
  };

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );

  return { publicKey, privateKey };
}

function getNotificationUrl(type?: string) {
  if (type === "chat") return "/general-chat";
  if (type === "news") return "/news";
  if (type === "login") return "/employees";
  if (type === "departure" || type === "arrival") return "/";
  return "/";
}

function getNotificationTag(params: {
  type?: string;
  organizationId?: string;
  newsId?: string;
  employeeUserId?: string;
  interventionId?: string;
}) {
  const { type, organizationId, newsId, employeeUserId, interventionId } = params;
  if (type === "chat") return `chat-${organizationId ?? "unknown"}`;
  if (type === "news") return `news-${newsId ?? "unknown"}`;
  if (type === "login") return `login-${employeeUserId ?? "unknown"}`;
  if (type === "departure") return `departure-${interventionId ?? "unknown"}`;
  if (type === "arrival") return `arrival-${interventionId ?? "unknown"}`;
  return `intervention-${interventionId ?? "unknown"}`;
}

function buildPayload(input: {
  title?: string;
  body?: string;
  urgency?: string;
  interventionId?: string;
  type?: string;
  organizationId?: string;
  newsId?: string;
  employeeUserId?: string;
}) {
  const { title, body, urgency, interventionId, type, organizationId, newsId, employeeUserId } = input;

  return JSON.stringify({
    title: title ?? "Notification",
    body: body ?? "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    tag: getNotificationTag({ type, organizationId, newsId, employeeUserId, interventionId }),
    requireInteraction: urgency === "high",
    data: {
      interventionId,
      urgency,
      type,
      newsId,
      url: getNotificationUrl(type),
    },
  });
}

async function sendEncryptedWebPush(args: {
  subscription: PushTargetSubscription;
  payload: string;
  appServer: webpush.ApplicationServer;
  ttl: number;
  urgency: webpush.Urgency;
}) {
  const { subscription, payload, appServer, ttl, urgency } = args;
  const subscriber = appServer.subscribe(subscription);
  await subscriber.pushTextMessage(payload, { ttl, urgency });
}

// ============ FCM (Firebase Cloud Messaging) Integration ============

interface FcmServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

async function getGoogleAccessToken(serviceAccount: FcmServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri,
    iat: now,
    exp: expiry,
  };

  const base64Header = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const base64Payload = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsignedToken = `${base64Header}.${base64Payload}`;

  // Import private key and sign
  const privateKeyPem = serviceAccount.private_key;
  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${base64Signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function sendFcmNotification(
  serviceAccount: FcmServiceAccount,
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ success: boolean; error?: string }> {
  const projectId = serviceAccount.project_id;
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data,
      android: {
        priority: "high",
        notification: {
          channel_id: "medicbike_interventions",
          sound: "default",
          default_vibrate_timings: true,
          default_light_settings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
      },
    },
  };

  try {
    const response = await fetch(fcmUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("FCM error response:", errorText);
      
      // Check if token is invalid
      if (response.status === 404 || errorText.includes("NOT_FOUND") || errorText.includes("UNREGISTERED")) {
        return { success: false, error: "TOKEN_INVALID" };
      }
      
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("FCM send error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============ Main Handler ============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const backendUrl = Deno.env.get("SUPABASE_URL")!;
    const backendServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT") || "";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(backendUrl, backendServiceKey);

    const body = await req.json();
    const {
      title,
      body: notifBody,
      urgency,
      interventionId,
      interventionTitle,
      type,
      organizationId,
      excludeUserId,
      newsId,
      senderUserId: providedSenderUserId,
      employeeUserId,
    } = body;

    let senderUserId = providedSenderUserId as string | undefined;

    if (!senderUserId) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseWithAuth = createClient(backendUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseWithAuth.auth.getClaims(token);

      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Invalid authentication" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      senderUserId = claimsData.claims.sub as string;
    }

    console.log("Sending push notification:", { title, type, urgency, interventionId, organizationId, newsId, senderUserId });

    let userIdsToNotify: string[] = [];

    // Helper: Get all creator user IDs (they should receive all notifications)
    const { data: creatorUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "creator");
    const creatorIds = (creatorUsers || []).map((c) => c.user_id);

    if (type === "login" && organizationId && employeeUserId) {
      // Login notification: notify admin and creators
      const { data: inviteCode } = await supabase.from("invite_codes").select("admin_id").eq("id", organizationId).single();
      if (inviteCode?.admin_id) {
        userIdsToNotify = [inviteCode.admin_id, ...creatorIds];
      } else {
        userIdsToNotify = [...creatorIds];
      }
    } else if (type === "news" && senderUserId) {
      // News notification: notify all org members from ALL admin's orgs + creators
      const { data: inviteCodes } = await supabase.from("invite_codes").select("id").eq("admin_id", senderUserId);
      const orgIds = (inviteCodes || []).map((ic) => ic.id);
      
      const allMemberIds: string[] = [...creatorIds];
      
      if (orgIds.length > 0) {
        const { data: orgMembers } = await supabase.from("profiles").select("user_id").in("invite_code_id", orgIds);
        (orgMembers || []).forEach((p) => allMemberIds.push(p.user_id));
      }
      
      // Remove duplicates and exclude sender
      userIdsToNotify = [...new Set(allMemberIds)].filter((id) => id !== senderUserId);
    } else if (type === "chat" && organizationId) {
      // Chat notification: notify all org members + creators except sender
      const { data: orgProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .or(`invite_code_id.eq.${organizationId},admin_id.eq.${organizationId}`);
      
      const allMemberIds = (orgProfiles || []).map((p) => p.user_id);
      // Add creators to receive chat notifications
      creatorIds.forEach((id) => allMemberIds.push(id));
      
      userIdsToNotify = [...new Set(allMemberIds)].filter((id) => id !== excludeUserId);
    } else if ((type === "departure" || type === "arrival") && senderUserId) {
      // Departure/Arrival notification: notify ALL members of the sender's organization(s) + creators (except sender)
      console.log(`Processing ${type} notification for sender:`, senderUserId);
      
      // Get sender's name
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name, invite_code_id")
        .eq("user_id", senderUserId)
        .maybeSingle();
      
      const senderName = senderProfile?.full_name || "Un membre";
      const orgId = senderProfile?.invite_code_id;
      
      // Build notification title and body based on type
      const notifTitle = type === "departure" 
        ? `🚗 Départ - ${interventionTitle || "Intervention"}`
        : `🎯 Arrivée - ${interventionTitle || "Intervention"}`;
      const notifMessage = type === "departure"
        ? `${senderName} part sur l'intervention`
        : `${senderName} est arrivé sur les lieux`;
      
      // Store computed title/body for later use
      (body as any).computedTitle = notifTitle;
      (body as any).computedBody = notifMessage;
      
      // Start with creators
      const allMemberIds: string[] = [...creatorIds];
      
      if (orgId) {
        // Get all org members
        const { data: orgMembers } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("invite_code_id", orgId);
        
        // Get admin of the org
        const { data: adminProfile } = await supabase
          .from("invite_codes")
          .select("admin_id")
          .eq("id", orgId)
          .maybeSingle();
        
        (orgMembers || []).forEach((p) => allMemberIds.push(p.user_id));
        if (adminProfile?.admin_id) allMemberIds.push(adminProfile.admin_id);
      }
      
      // Remove duplicates and exclude sender
      userIdsToNotify = [...new Set(allMemberIds)].filter((id) => id !== senderUserId);
      console.log(`Users to notify for ${type}:`, userIdsToNotify.length);
    } else if (type === "intervention" && senderUserId) {
      // Intervention notification: notify ALL members of the sender's organization(s) (except sender)
      console.log("Processing intervention notification for sender:", senderUserId);
      
      // Check if sender is admin or creator
      const { data: roleCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", senderUserId)
        .in("role", ["admin", "creator"])
        .maybeSingle();

      const allMemberIds: string[] = [];

      if (roleCheck?.role === "creator") {
        // Creator: notify ALL users from ALL organizations
        console.log("Sender is creator - notifying all users");
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("user_id");
        
        (allProfiles || []).forEach((p) => allMemberIds.push(p.user_id));
      } else if (roleCheck?.role === "admin") {
        // Sender is admin - get ALL their invite codes
        const { data: inviteCodes } = await supabase
          .from("invite_codes")
          .select("id")
          .eq("admin_id", senderUserId);
        
        const orgIds = (inviteCodes || []).map((ic) => ic.id);
        console.log("Sender is admin, org IDs:", orgIds);

        if (orgIds.length > 0) {
          // Get all members from all organizations
          const { data: orgMembers } = await supabase
            .from("profiles")
            .select("user_id")
            .in("invite_code_id", orgIds);
          
          (orgMembers || []).forEach((p) => allMemberIds.push(p.user_id));
          console.log("Found org members:", (orgMembers || []).length);
        }
      } else {
        // Sender is employee - get their org ID from profile
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("invite_code_id")
          .eq("user_id", senderUserId)
          .maybeSingle();
        
        const orgId = senderProfile?.invite_code_id || null;
        console.log("Sender is employee, org ID:", orgId);

        if (orgId) {
          // Get all org members
          const { data: orgMembers } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("invite_code_id", orgId);
          
          // Get admin of the org
          const { data: adminProfile } = await supabase
            .from("invite_codes")
            .select("admin_id")
            .eq("id", orgId)
            .maybeSingle();
          
          (orgMembers || []).forEach((p) => allMemberIds.push(p.user_id));
          if (adminProfile?.admin_id) allMemberIds.push(adminProfile.admin_id);
        }
      }

      // Remove duplicates and exclude sender
      userIdsToNotify = [...new Set(allMemberIds)].filter((id) => id !== senderUserId);
      console.log("Users to notify for intervention:", userIdsToNotify.length, userIdsToNotify);
    } else if (senderUserId) {
      // Default case: notify org members (legacy behavior)
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("invite_code_id, admin_id")
        .eq("user_id", senderUserId)
        .maybeSingle();

      if (senderProfile) {
        // Check if sender is creator or admin
        const { data: roleCheck } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", senderUserId)
          .in("role", ["admin", "creator"])
          .maybeSingle();

        let orgIds: string[] = [];

        if (roleCheck?.role === "creator") {
          // Creator: get ALL invite codes
          const { data: allCodes } = await supabase.from("invite_codes").select("id");
          orgIds = (allCodes || []).map((ic) => ic.id);
        } else if (roleCheck?.role === "admin") {
          const { data: inviteCodes } = await supabase.from("invite_codes").select("id").eq("admin_id", senderUserId);
          orgIds = (inviteCodes || []).map((ic) => ic.id);
        } else if (senderProfile.invite_code_id) {
          orgIds = [senderProfile.invite_code_id];
        }

        if (orgIds.length > 0) {
          const { data: orgMembers } = await supabase.from("profiles").select("user_id").in("invite_code_id", orgIds);
          const memberIds = (orgMembers || []).map((p) => p.user_id);
          
          // Also add admins of these orgs
          const { data: adminProfiles } = await supabase.from("invite_codes").select("admin_id").in("id", orgIds);
          (adminProfiles || []).forEach((ap) => {
            if (ap.admin_id) memberIds.push(ap.admin_id);
          });
          
          userIdsToNotify = [...new Set(memberIds)].filter((id) => id !== senderUserId);
        }
      }
    }

    if (userIdsToNotify.length === 0) {
      console.log("No users to notify");
      return new Response(JSON.stringify({ message: "No users to notify", total: 0, successful: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ Fetch both Web Push and FCM subscriptions ============
    const [webPushResult, fcmResult] = await Promise.all([
      supabase.from("push_subscriptions").select("*").in("user_id", userIdsToNotify),
      supabase.from("fcm_tokens").select("*").in("user_id", userIdsToNotify),
    ]);

    const subscriptions = webPushResult.data || [];
    const fcmTokens = (fcmResult.data || []) as FcmTokenRow[];

    console.log(`Found ${subscriptions.length} web push subscriptions and ${fcmTokens.length} FCM tokens for ${userIdsToNotify.length} users`);

    // Use computed title/body for departure/arrival notifications
    const finalTitle = (body as any).computedTitle || title;
    const finalBody = (body as any).computedBody || notifBody;

    // ============ Send Web Push Notifications ============
    let webPushSuccessful = 0;
    
    if (subscriptions.length > 0) {
      const vapidKeys = await importVapidKeyPairFromBase64Url(vapidPublicKey, vapidPrivateKey);

      const appServer = await webpush.ApplicationServer.new({
        contactInformation: "mailto:contact@medicbike.lovable.app",
        vapidKeys,
      });

      const payload = buildPayload({
        title: finalTitle,
        body: finalBody,
        urgency,
        interventionId,
        type,
        organizationId,
        newsId,
        employeeUserId,
      });

      const webPushResults = await Promise.allSettled(
        subscriptions.map(async (sub: DbSubscriptionRow) => {
          try {
            const target: PushTargetSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
            await sendEncryptedWebPush({
              subscription: target,
              payload,
              appServer,
              ttl: 86400,
              urgency: webpush.Urgency.High,
            });
            console.log("Web push sent successfully to user:", sub.user_id);
            return { success: true, userId: sub.user_id };
          } catch (err: unknown) {
            if (err instanceof webpush.PushMessageError) {
              console.error("PushMessageError for user", sub.user_id, ":", err.toString());
              if (err.isGone()) {
                console.log("Removing invalid web push subscription:", sub.id);
                await supabase.from("push_subscriptions").delete().eq("id", sub.id);
              }
              return { success: false, status: err.response.status };
            }

            const e = err as Error;
            console.error("Web push error for user", sub.user_id, ":", e?.message || err);
            return { success: false, error: e?.message || "Unknown" };
          }
        }),
      );

      webPushSuccessful = webPushResults.filter((r) => r.status === "fulfilled" && (r.value as { success: boolean }).success).length;
      console.log(`Web push notifications sent: ${webPushSuccessful}/${subscriptions.length}`);
    }

    // ============ Send FCM Notifications (Native iOS/Android) ============
    let fcmSuccessful = 0;

    if (fcmTokens.length > 0 && fcmServiceAccountJson) {
      try {
        const serviceAccount: FcmServiceAccount = JSON.parse(fcmServiceAccountJson);
        const accessToken = await getGoogleAccessToken(serviceAccount);
        
        const fcmData: Record<string, string> = {
          type: type || "notification",
          interventionId: interventionId || "",
          urgency: urgency || "medium",
          newsId: newsId || "",
          url: getNotificationUrl(type),
        };

        const fcmResults = await Promise.allSettled(
          fcmTokens.map(async (fcm) => {
            const result = await sendFcmNotification(
              serviceAccount,
              accessToken,
              fcm.token,
              finalTitle || "Notification",
              finalBody || "",
              fcmData,
            );

            if (result.success) {
              console.log(`FCM sent successfully to user ${fcm.user_id} (${fcm.platform})`);
              return { success: true, userId: fcm.user_id };
            } else {
              console.error(`FCM error for user ${fcm.user_id}:`, result.error);
              
              // Remove invalid tokens
              if (result.error === "TOKEN_INVALID") {
                console.log("Removing invalid FCM token:", fcm.id);
                await supabase.from("fcm_tokens").delete().eq("id", fcm.id);
              }
              
              return { success: false, error: result.error };
            }
          }),
        );

        fcmSuccessful = fcmResults.filter((r) => r.status === "fulfilled" && (r.value as { success: boolean }).success).length;
        console.log(`FCM notifications sent: ${fcmSuccessful}/${fcmTokens.length}`);
      } catch (fcmErr) {
        console.error("FCM initialization error:", fcmErr instanceof Error ? fcmErr.message : fcmErr);
      }
    } else if (fcmTokens.length > 0) {
      console.log("FCM tokens found but FCM_SERVICE_ACCOUNT not configured");
    }

    const totalSent = webPushSuccessful + fcmSuccessful;
    const totalSubscriptions = subscriptions.length + fcmTokens.length;

    console.log(`Total notifications sent: ${totalSent}/${totalSubscriptions}`);

    return new Response(
      JSON.stringify({ 
        message: "Notifications sent", 
        total: totalSubscriptions, 
        successful: totalSent,
        webPush: { total: subscriptions.length, successful: webPushSuccessful },
        fcm: { total: fcmTokens.length, successful: fcmSuccessful },
        usersNotified: userIdsToNotify.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

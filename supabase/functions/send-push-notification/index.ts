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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const backendUrl = Deno.env.get("SUPABASE_URL")!;
    const backendServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";

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

    if (type === "login" && organizationId && employeeUserId) {
      // Login notification: notify admin only
      const { data: inviteCode } = await supabase.from("invite_codes").select("admin_id").eq("id", organizationId).single();
      if (inviteCode?.admin_id) userIdsToNotify = [inviteCode.admin_id];
    } else if (type === "news" && senderUserId) {
      // News notification: notify all org members from ALL admin's orgs
      const { data: inviteCodes } = await supabase.from("invite_codes").select("id").eq("admin_id", senderUserId);
      const orgIds = (inviteCodes || []).map((ic) => ic.id);
      
      if (orgIds.length > 0) {
        const { data: orgMembers } = await supabase.from("profiles").select("user_id").in("invite_code_id", orgIds);
        userIdsToNotify = (orgMembers || []).map((p) => p.user_id);
      }
    } else if (type === "chat" && organizationId) {
      // Chat notification: notify all org members except sender
      const { data: orgProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .or(`invite_code_id.eq.${organizationId},admin_id.eq.${organizationId}`);
      userIdsToNotify = (orgProfiles || []).map((p) => p.user_id).filter((id) => id !== excludeUserId);
    } else if ((type === "departure" || type === "arrival") && senderUserId) {
      // Departure/Arrival notification: notify ALL members of the sender's organization(s) (except sender)
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
      
      const allMemberIds: string[] = [];
      
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
      
      // Check if sender is admin
      const { data: adminCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", senderUserId)
        .eq("role", "admin")
        .maybeSingle();

      const allMemberIds: string[] = [];

      if (adminCheck) {
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
        const { data: adminCheck } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", senderUserId)
          .eq("role", "admin")
          .maybeSingle();

        let orgIds: string[] = [];

        if (adminCheck) {
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

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIdsToNotify);

    if (subError) throw subError;

    console.log(`Found ${subscriptions?.length || 0} subscriptions for ${userIdsToNotify.length} users to notify`);

    const vapidKeys = await importVapidKeyPairFromBase64Url(vapidPublicKey, vapidPrivateKey);

    const appServer = await webpush.ApplicationServer.new({
      contactInformation: "mailto:contact@medicbike.lovable.app",
      vapidKeys,
    });

    // Use computed title/body for departure/arrival notifications
    const finalTitle = (body as any).computedTitle || title;
    const finalBody = (body as any).computedBody || notifBody;

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

    const results = await Promise.allSettled(
      (subscriptions || []).map(async (sub: DbSubscriptionRow) => {
        try {
          const target: PushTargetSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
          await sendEncryptedWebPush({
            subscription: target,
            payload,
            appServer,
            ttl: 86400,
            urgency: webpush.Urgency.High,
          });
          console.log("Push sent successfully to user:", sub.user_id);
          return { success: true, userId: sub.user_id };
        } catch (err: unknown) {
          if (err instanceof webpush.PushMessageError) {
            console.error("PushMessageError for user", sub.user_id, ":", err.toString());
            if (err.isGone()) {
              console.log("Removing invalid subscription:", sub.id);
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            }
            return { success: false, status: err.response.status };
          }

          const e = err as Error;
          console.error("Push error for user", sub.user_id, ":", e?.message || err);
          return { success: false, error: e?.message || "Unknown" };
        }
      }),
    );

    const successful = results.filter((r) => r.status === "fulfilled" && (r.value as { success: boolean }).success).length;

    console.log(`Notifications sent: ${successful}/${subscriptions?.length || 0}`);

    return new Response(
      JSON.stringify({ message: "Notifications sent", total: subscriptions?.length || 0, successful, usersNotified: userIdsToNotify.length }),
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

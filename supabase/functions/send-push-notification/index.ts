import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert Uint8Array to URL-safe base64
function uint8ArrayToUrlBase64(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Import raw key for ECDSA signing (ES256)
async function importVapidSigningKey(publicKeyBase64: string, privateKeyBase64: string): Promise<CryptoKey> {
  // Public key is typically the uncompressed P-256 point: 65 bytes (0x04 + X(32) + Y(32))
  const publicKeyBytesRaw = urlBase64ToUint8Array(publicKeyBase64);
  const publicKeyBytes = publicKeyBytesRaw.length === 64
    ? new Uint8Array([0x04, ...publicKeyBytesRaw])
    : publicKeyBytesRaw;

  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
    throw new Error(`Invalid VAPID public key length/format: ${publicKeyBytes.length}`);
  }

  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);

  // Private key should be 32 raw bytes
  const dBytes = urlBase64ToUint8Array(privateKeyBase64);
  if (dBytes.length !== 32) {
    throw new Error(`Invalid VAPID private key length: ${dBytes.length}`);
  }

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ArrayToUrlBase64(x),
    y: uint8ArrayToUrlBase64(y),
    d: uint8ArrayToUrlBase64(dBytes),
    ext: true,
  };

  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

// Create JWT for VAPID authentication
async function createVapidJwt(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const headerB64 = uint8ArrayToUrlBase64(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToUrlBase64(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  try {
    const key = await importVapidSigningKey(publicKey, privateKey);
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(unsignedToken)
    );
    const signatureB64 = uint8ArrayToUrlBase64(new Uint8Array(signature));
    return `${unsignedToken}.${signatureB64}`;
  } catch (error) {
    console.error('Error creating JWT:', error);
    throw error;
  }
}

// Send a single push notification using fetch
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<Response> {
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;
  
  const jwt = await createVapidJwt(audience, subject, vapidPublicKey, vapidPrivateKey);
  
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Urgency': 'high',
    },
    body: payload,
  });
  
  return response;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    const { 
      title, 
      body: notifBody, 
      urgency, 
      interventionId, 
      type, 
      organizationId, 
      excludeUserId, 
      newsId,
      senderUserId: providedSenderUserId,
      employeeUserId
    } = body;
    
    let senderUserId = providedSenderUserId;
    
    // If not a webhook call, require authentication
    if (!senderUserId) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Create client with user's auth for getClaims
      const supabaseWithAuth = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabaseWithAuth.auth.getClaims(token);
      
      if (claimsError || !claimsData?.claims) {
        console.error('Invalid token:', claimsError);
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      senderUserId = claimsData.claims.sub as string;
    }
    
    console.log('Sending push notification:', { title, type, urgency, interventionId, organizationId, newsId, senderUserId });

    let userIdsToNotify: string[] = [];
    
    if (type === 'login' && organizationId && employeeUserId) {
      // Login notification - notify admin of the organization
      const { data: inviteCode } = await supabase
        .from('invite_codes')
        .select('admin_id')
        .eq('id', organizationId)
        .single();
      
      if (inviteCode?.admin_id) {
        userIdsToNotify = [inviteCode.admin_id];
        console.log('Login notification - Notifying admin:', inviteCode.admin_id);
      }
    } else if (type === 'news' && senderUserId) {
      const { data: inviteCode } = await supabase
        .from('invite_codes')
        .select('id')
        .eq('admin_id', senderUserId)
        .single();
      
      if (inviteCode?.id) {
        const { data: orgMembers } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('invite_code_id', inviteCode.id);
        
        userIdsToNotify = (orgMembers || []).map(p => p.user_id);
        console.log('News - Users to notify:', userIdsToNotify.length);
      }
    } else if (type === 'chat' && organizationId) {
      const { data: orgProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`invite_code_id.eq.${organizationId},admin_id.eq.${organizationId}`);
      
      userIdsToNotify = (orgProfiles || [])
        .map(p => p.user_id)
        .filter(id => id !== excludeUserId);
        
    } else if (senderUserId) {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('invite_code_id, admin_id')
        .eq('user_id', senderUserId)
        .single();
      
      console.log('Sender profile:', senderProfile);
      
      if (senderProfile) {
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', senderUserId)
          .eq('role', 'admin')
          .single();
        
        let orgId: string | null = null;
        
        if (adminCheck) {
          const { data: inviteCode } = await supabase
            .from('invite_codes')
            .select('id')
            .eq('admin_id', senderUserId)
            .single();
          
          orgId = inviteCode?.id || null;
          console.log('Admin org ID:', orgId);
        } else {
          orgId = senderProfile.invite_code_id;
          console.log('Employee org ID:', orgId);
        }
        
        if (orgId) {
          const { data: orgMembers } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('invite_code_id', orgId);
          
          const { data: adminProfile } = await supabase
            .from('invite_codes')
            .select('admin_id')
            .eq('id', orgId)
            .single();
          
          const memberIds = (orgMembers || []).map(p => p.user_id);
          if (adminProfile?.admin_id) {
            memberIds.push(adminProfile.admin_id);
          }
          
          userIdsToNotify = [...new Set(memberIds)].filter(id => id !== senderUserId);
          console.log('Users to notify:', userIdsToNotify.length);
        }
      }
    }
    
    if (userIdsToNotify.length === 0) {
      console.log('No users to notify');
      return new Response(
        JSON.stringify({ message: 'No users to notify', total: 0, successful: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIdsToNotify);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions to notify`);

    const getNotificationUrl = () => {
      if (type === 'chat') return '/general-chat';
      if (type === 'news') return '/news';
      if (type === 'login') return '/employees';
      return '/';
    };

    const getNotificationTag = () => {
      if (type === 'chat') return `chat-${organizationId}`;
      if (type === 'news') return `news-${newsId}`;
      if (type === 'login') return `login-${employeeUserId}`;
      return `intervention-${interventionId}`;
    };

    const payload = JSON.stringify({
      title,
      body: notifBody,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: getNotificationTag(),
      requireInteraction: urgency === 'high',
      data: {
        interventionId,
        urgency,
        type,
        newsId,
        url: getNotificationUrl(),
      },
    });

    // Send to all subscriptions
    const results = await Promise.allSettled(
      (subscriptions || []).map(async (sub) => {
        try {
          console.log('Sending to endpoint:', sub.endpoint.substring(0, 60));
          
          const response = await sendPushNotification(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
            vapidPublicKey,
            vapidPrivateKey,
            'mailto:contact@medicbike.lovable.app'
          );
          
          if (response.ok || response.status === 201) {
            console.log('Push sent successfully to user:', sub.user_id);
            return { success: true, userId: sub.user_id };
          } else {
            console.error('Push failed with status:', response.status);
            
            // If subscription is invalid, delete it
            if (response.status === 404 || response.status === 410) {
              console.log('Removing invalid subscription:', sub.id);
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
            }
            
            return { success: false, status: response.status };
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Push error for subscription:', error.message);
          return { success: false, error: error.message };
        }
      })
    );

    const successful = results.filter(
      r => r.status === 'fulfilled' && (r.value as { success: boolean }).success
    ).length;
    
    console.log(`Notifications sent: ${successful}/${subscriptions?.length || 0}`);
    
    return new Response(
      JSON.stringify({ 
        message: 'Notifications sent',
        total: subscriptions?.length || 0,
        successful,
        usersNotified: userIdsToNotify.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

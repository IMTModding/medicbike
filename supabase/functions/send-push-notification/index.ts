import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { title, body, urgency, interventionId, type, organizationId, excludeUserId } = await req.json();
    
    console.log('Sending push notification:', { title, type, urgency, interventionId, organizationId });

    let subscriptionsQuery = supabase
      .from('push_subscriptions')
      .select('*, profiles!inner(invite_code_id, admin_id, user_id)');
    
    // For chat notifications, only notify users in the same organization
    if (type === 'chat' && organizationId) {
      // Get users in this organization (employees with this invite_code_id or admin who created it)
      const { data: orgProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`invite_code_id.eq.${organizationId},admin_id.eq.${organizationId}`);
      
      const userIds = (orgProfiles || []).map(p => p.user_id).filter(id => id !== excludeUserId);
      
      if (userIds.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No users to notify', total: 0, successful: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      subscriptionsQuery = supabase
        .from('push_subscriptions')
        .select('*')
        .in('user_id', userIds);
    }

    const { data: subscriptions, error: subError } = await subscriptionsQuery;

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    // Filter out the sender for chat messages
    const filteredSubscriptions = excludeUserId 
      ? (subscriptions || []).filter(s => s.user_id !== excludeUserId)
      : subscriptions;

    console.log(`Found ${filteredSubscriptions?.length || 0} subscriptions to notify`);

    const payload = JSON.stringify({
      title,
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: type === 'chat' ? `chat-${organizationId}` : interventionId,
      data: {
        interventionId,
        urgency,
        type,
        url: type === 'chat' ? '/general-chat' : '/',
      },
    });

    // Send to all subscriptions using simple fetch
    const results = await Promise.allSettled(
      (filteredSubscriptions || []).map(async (sub) => {
        try {
          console.log('Sending to endpoint:', sub.endpoint.substring(0, 60));
          
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '86400',
            },
            body: payload,
          });

          console.log('Response status:', response.status);

          if (!response.ok) {
            // If subscription is invalid, delete it
            if (response.status === 404 || response.status === 410) {
              console.log('Removing invalid subscription:', sub.id);
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
            }
            throw new Error(`Push failed: ${response.status}`);
          }

          console.log('Push sent successfully');
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error('Push error for subscription:', errorMessage);
          return { success: false, error: errorMessage };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length;
    
    return new Response(
      JSON.stringify({ 
        message: 'Notifications sent',
        total: subscriptions?.length || 0,
        successful,
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

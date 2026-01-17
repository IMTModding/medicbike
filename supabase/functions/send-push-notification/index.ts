import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const senderUserId = user.id;
    
    const { title, body, urgency, interventionId, type, organizationId, excludeUserId } = await req.json();
    
    console.log('Sending push notification:', { title, type, urgency, interventionId, organizationId, senderUserId });

    let userIdsToNotify: string[] = [];
    
    if (type === 'chat' && organizationId) {
      // For chat notifications, notify users in the same organization
      const { data: orgProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`invite_code_id.eq.${organizationId},admin_id.eq.${organizationId}`);
      
      userIdsToNotify = (orgProfiles || [])
        .map(p => p.user_id)
        .filter(id => id !== excludeUserId);
        
    } else if (senderUserId) {
      // For intervention alerts, get the sender's organization and notify all members
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('invite_code_id, admin_id')
        .eq('user_id', senderUserId)
        .single();
      
      console.log('Sender profile:', senderProfile);
      
      if (senderProfile) {
        // Check if sender is an admin (has admin_id set to their invite_code_id)
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', senderUserId)
          .eq('role', 'admin')
          .single();
        
        let orgId: string | null = null;
        
        if (adminCheck) {
          // Sender is admin - get their invite code ID
          const { data: inviteCode } = await supabase
            .from('invite_codes')
            .select('id')
            .eq('admin_id', senderUserId)
            .single();
          
          orgId = inviteCode?.id || null;
          console.log('Admin org ID:', orgId);
        } else {
          // Sender is employee - use their invite_code_id
          orgId = senderProfile.invite_code_id;
          console.log('Employee org ID:', orgId);
        }
        
        if (orgId) {
          // Get all users in this organization (employees + admin)
          const { data: orgMembers } = await supabase
            .from('profiles')
            .select('user_id')
            .or(`invite_code_id.eq.${orgId}`);
          
          // Also get the admin
          const { data: adminProfile } = await supabase
            .from('invite_codes')
            .select('admin_id')
            .eq('id', orgId)
            .single();
          
          const memberIds = (orgMembers || []).map(p => p.user_id);
          if (adminProfile?.admin_id) {
            memberIds.push(adminProfile.admin_id);
          }
          
          // Exclude the sender
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

    // Get push subscriptions for these users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIdsToNotify);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions to notify`);

    const payload = JSON.stringify({
      title,
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: type === 'chat' ? `chat-${organizationId}` : `intervention-${interventionId}`,
      requireInteraction: urgency === 'high',
      data: {
        interventionId,
        urgency,
        type,
        url: type === 'chat' ? '/general-chat' : '/',
      },
    });

    // Send to all subscriptions
    const results = await Promise.allSettled(
      (subscriptions || []).map(async (sub) => {
        try {
          console.log('Sending to endpoint:', sub.endpoint.substring(0, 60));
          
          const headers: Record<string, string> = {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
          };

          // Simple push without encryption for now (works for testing)
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

          console.log('Push sent successfully to user:', sub.user_id);
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error('Push error for subscription:', errorMessage);
          return { success: false, error: errorMessage };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length;
    
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Configure web-push with VAPID details
    webpush.setVapidDetails(
      'mailto:contact@medicbike.lovable.app',
      vapidPublicKey,
      vapidPrivateKey
    );

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
      // For webhook trigger - already has senderUserId
      senderUserId: providedSenderUserId
    } = body;
    
    let senderUserId = providedSenderUserId;
    
    // If not a webhook call, require authentication
    if (!senderUserId) {
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
      
      senderUserId = user.id;
    }
    
    console.log('Sending push notification:', { title, type, urgency, interventionId, organizationId, newsId, senderUserId });

    let userIdsToNotify: string[] = [];
    
    if (type === 'news' && senderUserId) {
      // For news notifications, notify all users in the admin's organization
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
        // Check if sender is an admin
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
            .eq('invite_code_id', orgId);
          
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

    const getNotificationUrl = () => {
      if (type === 'chat') return '/general-chat';
      if (type === 'news') return '/news';
      return '/';
    };

    const getNotificationTag = () => {
      if (type === 'chat') return `chat-${organizationId}`;
      if (type === 'news') return `news-${newsId}`;
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

    // Send to all subscriptions using web-push
    const results = await Promise.allSettled(
      (subscriptions || []).map(async (sub) => {
        try {
          console.log('Sending to endpoint:', sub.endpoint.substring(0, 60));
          
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(pushSubscription, payload);
          console.log('Push sent successfully to user:', sub.user_id);
          return { success: true, userId: sub.user_id };
        } catch (err: unknown) {
          const error = err as Error & { statusCode?: number };
          console.error('Push error for subscription:', error.message);
          
          // If subscription is invalid (expired or unsubscribed), delete it
          if (error.statusCode === 404 || error.statusCode === 410) {
            console.log('Removing invalid subscription:', sub.id);
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }
          
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

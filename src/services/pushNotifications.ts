import { supabase } from '@/integrations/supabase/client';

// Prefer a build-time key (when configured), otherwise fetch it from the backend.
let cachedVapidPublicKey: string | null = null;
const VITE_VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

async function getVapidPublicKey(): Promise<string> {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;
  if (VITE_VAPID_PUBLIC_KEY) {
    cachedVapidPublicKey = VITE_VAPID_PUBLIC_KEY;
    return cachedVapidPublicKey;
  }

  try {
    console.log('[Push] Fetching VAPID public key from backend...');
    const { data, error } = await supabase.functions.invoke('vapid-public-key');
    if (error) {
      console.error('[Push] Unable to fetch VAPID public key:', error);
      return '';
    }

    const key = (data as any)?.publicKey || '';
    console.log('[Push] VAPID key fetched, length:', key.length);
    cachedVapidPublicKey = key;
    return key;
  } catch (err) {
    console.error('[Push] Exception fetching VAPID key:', err);
    return '';
  }
}

export const isPushSupported = (): boolean => {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermission => {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.log('[Push] Notifications not supported');
    return 'denied';
  }
  
  const permission = await Notification.requestPermission();
  console.log('[Push] Notification permission:', permission);
  return permission;
};

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.log('[Push] Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Important for Push: ensure the newest SW becomes active.
    // If a SW is left in "waiting", push events may not be handled by the code the user expects.
    const trySkipWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        console.log('[Push] SW is waiting -> sending SKIP_WAITING');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    };

    trySkipWaiting(registration);

    if (registration.installing) {
      registration.installing.addEventListener('statechange', () => {
        if (registration.waiting) trySkipWaiting(registration);
      });
    }

    // Ask the browser to check for an updated SW script.
    // (No caching logic inside sw.js, so this is safe.)
    try {
      await registration.update();
    } catch {
      // ignore
    }

    // Wait until an active SW is ready
    await navigator.serviceWorker.ready;

    const activeUrl = (await navigator.serviceWorker.getRegistration())?.active?.scriptURL;
    console.log('[Push] Service Worker registered:', registration.scope, 'active:', activeUrl);

    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Store last error for debugging
let lastSubscriptionError: string | null = null;

export const getLastSubscriptionError = (): string | null => lastSubscriptionError;

export const subscribeToPush = async (userId: string): Promise<boolean> => {
  console.log('[Push] Starting subscription for user:', userId);
  lastSubscriptionError = null;
  
  try {
    // Step 1: Request permission
    console.log('[Push] Step 1: Requesting permission...');
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      lastSubscriptionError = `Permission: ${permission}`;
      console.log('[Push] Permission denied:', permission);
      return false;
    }
    console.log('[Push] Permission granted');

    // Step 2: Register service worker
    console.log('[Push] Step 2: Registering service worker...');
    const registration = await registerServiceWorker();
    if (!registration) {
      lastSubscriptionError = 'Service Worker non enregistré';
      console.log('[Push] No service worker registration');
      return false;
    }
    console.log('[Push] SW registered');

    // Step 3: Wait for service worker to be ready
    console.log('[Push] Step 3: Waiting for service worker to be ready...');
    await navigator.serviceWorker.ready;
    console.log('[Push] Service worker ready');

    // Step 4: Get VAPID key
    console.log('[Push] Step 4: Fetching VAPID key...');
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
      lastSubscriptionError = 'Clé VAPID vide';
      console.error('[Push] VAPID public key is empty!');
      return false;
    }
    console.log('[Push] VAPID key obtained, length:', vapidPublicKey.length);

    // Step 5: Get or create subscription
    console.log('[Push] Step 5: Getting/creating subscription...');
    let subscription = await registration.pushManager.getSubscription();
    console.log('[Push] Existing subscription:', subscription ? 'yes' : 'no');

    if (!subscription) {
      try {
        console.log('[Push] Creating new subscription with VAPID...');
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        console.log('[Push] Subscription created:', subscription.endpoint.substring(0, 50));
      } catch (subError: unknown) {
        const err = subError as Error;
        lastSubscriptionError = `Subscribe error: ${err.message}`;
        console.error('[Push] Error creating subscription:', err.message, err);
        return false;
      }
    }

    if (!subscription) {
      lastSubscriptionError = 'Subscription null après création';
      console.error('[Push] No subscription available');
      return false;
    }

    // Step 6: Save subscription to database
    console.log('[Push] Step 6: Saving to database...');
    const subscriptionJson = subscription.toJSON();
    
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscriptionJson.keys?.p256dh || '',
          auth: subscriptionJson.keys?.auth || '',
        },
        {
          onConflict: 'user_id,endpoint',
        }
      );

    if (error) {
      lastSubscriptionError = `DB error: ${error.message}`;
      console.error('[Push] Error saving subscription:', error);
      return false;
    }

    console.log('[Push] SUCCESS! Subscription saved.');
    return true;
  } catch (error: unknown) {
    const err = error as Error;
    lastSubscriptionError = `Exception: ${err.message}`;
    console.error('[Push] Exception in subscribeToPush:', err);
    return false;
  }
};

export const getCurrentPushSubscription = async (): Promise<PushSubscription | null> => {
  try {
    if (!('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Error getting push subscription:', error);
    return null;
  }
};

/**
 * Ensures the device is subscribed and the subscription is persisted in DB.
 * Also checks if the subscription might be stale and refreshes it.
 * Useful after page reloads when Notification.permission is still "granted".
 */
export const ensurePushSubscription = async (userId: string): Promise<boolean> => {
  const permission = getNotificationPermission();
  if (permission !== 'granted') return false;

  try {
    // Check when the subscription was last saved in DB
    const { data: existingInDb } = await supabase
      .from('push_subscriptions')
      .select('id, created_at, endpoint')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const existing = await getCurrentPushSubscription();
    
    // If subscription exists in browser
    if (existing) {
      const json = existing.toJSON();
      
      // Check if this is a different endpoint than what's in DB (new subscription)
      // or if the DB subscription is older than 5 days (might be stale)
      const isNewEndpoint = !existingInDb || existingInDb.endpoint !== existing.endpoint;
      const isStale = existingInDb && 
        (new Date().getTime() - new Date(existingInDb.created_at).getTime() > 5 * 24 * 60 * 60 * 1000);
      
      if (isStale) {
        console.log('[Push] Subscription is stale (>5 days), refreshing...');
        // Unsubscribe and create a fresh subscription
        try {
          await existing.unsubscribe();
          // Delete old subscriptions for this user
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId);
          
          // Create fresh subscription
          return await subscribeToPush(userId);
        } catch (e) {
          console.error('[Push] Error refreshing stale subscription:', e);
        }
      }
      
      // Save/update the subscription in DB
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint: existing.endpoint,
            p256dh: json.keys?.p256dh || '',
            auth: json.keys?.auth || '',
          },
          { onConflict: 'user_id,endpoint' }
        );
      
      if (error) {
        console.error('[Push] Error saving subscription:', error);
        return false;
      }
      
      if (isNewEndpoint) {
        console.log('[Push] New endpoint saved to DB');
      }
      return true;
    }

    // No browser subscription exists, create a new one
    console.log('[Push] No browser subscription found, creating new...');
    return await subscribeToPush(userId);
  } catch (e) {
    console.error('[Push] Error in ensurePushSubscription:', e);
    return false;
  }
};

export const unsubscribeFromPush = async (userId: string): Promise<boolean> => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      
      // Remove from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint);
      
      console.log('[Push] Unsubscribed from push');
    }

    return true;
  } catch (error) {
    console.error('[Push] Error unsubscribing:', error);
    return false;
  }
};

export const sendPushNotification = async (
  title: string,
  body: string,
  urgency: string,
  interventionId: string
): Promise<boolean> => {
  try {
    console.log('[Push] Sending intervention notification:', { title, urgency, interventionId });
    
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { 
        title, 
        body, 
        urgency, 
        interventionId,
        type: 'intervention' // Explicit type for intervention notifications
      },
    });

    if (error) {
      console.error('[Push] Error sending push:', error);
      return false;
    }

    console.log('[Push] Push notification sent successfully:', data);
    return true;
  } catch (error) {
    console.error('[Push] Error sending push:', error);
    return false;
  }
};

export const sendChatNotification = async (
  senderName: string,
  message: string,
  organizationId: string,
  excludeUserId?: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { 
        title: `💬 ${senderName}`,
        body: message.length > 50 ? message.substring(0, 50) + '...' : message,
        type: 'chat',
        organizationId,
        // Only exclude if explicitly provided
        ...(excludeUserId && { excludeUserId }),
      },
    });

    if (error) {
      console.error('[Push] Error sending chat notification:', error);
      return false;
    }

    console.log('[Push] Chat notification sent');
    return true;
  } catch (error) {
    console.error('[Push] Error sending chat notification:', error);
    return false;
  }
};

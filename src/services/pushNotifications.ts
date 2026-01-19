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

  const { data, error } = await supabase.functions.invoke('vapid-public-key');
  if (error) {
    console.error('Unable to fetch VAPID public key:', error);
    return '';
  }

  const key = (data as any)?.publicKey || '';
  cachedVapidPublicKey = key;
  return key;
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
    console.log('Notifications not supported');
    return 'denied';
  }
  
  const permission = await Notification.requestPermission();
  console.log('Notification permission:', permission);
  return permission;
};

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
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

export const subscribeToPush = async (userId: string): Promise<boolean> => {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      console.log('No service worker registration');
      return false;
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    const vapidPublicKey = await getVapidPublicKey();

    if (!subscription && vapidPublicKey) {
      // Create new subscription
      // NOTE: PushManager.subscribe expects a Uint8Array for applicationServerKey
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      console.log('Push subscription created:', subscription);
    }

    if (!subscription && !vapidPublicKey) {
      console.warn('VAPID public key missing; cannot subscribe to push');
    }

    if (subscription) {
      // Save subscription to database
      const subscriptionJson = subscription.toJSON();
      
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscriptionJson.keys?.p256dh || '',
          auth: subscriptionJson.keys?.auth || '',
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (error) {
        console.error('Error saving subscription:', error);
        return false;
      }

      console.log('Subscription saved to database');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error subscribing to push:', error);
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
      
      console.log('Unsubscribed from push');
    }

    return true;
  } catch (error) {
    console.error('Error unsubscribing:', error);
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
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { title, body, urgency, interventionId },
    });

    if (error) {
      console.error('Error sending push:', error);
      return false;
    }

    console.log('Push notification sent');
    return true;
  } catch (error) {
    console.error('Error sending push:', error);
    return false;
  }
};

export const sendChatNotification = async (
  senderName: string,
  message: string,
  organizationId: string,
  excludeUserId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { 
        title: `💬 ${senderName}`,
        body: message.length > 50 ? message.substring(0, 50) + '...' : message,
        type: 'chat',
        organizationId,
        excludeUserId,
      },
    });

    if (error) {
      console.error('Error sending chat notification:', error);
      return false;
    }

    console.log('Chat notification sent');
    return true;
  } catch (error) {
    console.error('Error sending chat notification:', error);
    return false;
  }
};

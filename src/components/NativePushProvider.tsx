import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Debug logging helper
function debugLog(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const prefix = `[NativePush ${timestamp}]`;
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

interface NativePushProviderProps {
  children: React.ReactNode;
}

export const NativePushProvider = ({ children }: NativePushProviderProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isInitializedRef = useRef(false);
  const listenersAttachedRef = useRef(false);
  const currentTokenRef = useRef<string | null>(null);

  // Check if running in native environment
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // Save FCM token to database
  const saveFcmToken = useCallback(async (userId: string, token: string): Promise<boolean> => {
    debugLog('Saving FCM token...', { userId, tokenLength: token?.length, platform });
    
    if (platform === 'web') {
      debugLog('Web platform, skipping FCM token save');
      return false;
    }

    try {
      const { error, data } = await supabase
        .from('fcm_tokens')
        .upsert(
          {
            user_id: userId,
            token,
            platform,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,token',
          }
        )
        .select();

      if (error) {
        debugLog('Error saving FCM token', error);
        console.error('Error saving FCM token:', error);
        return false;
      }

      debugLog('FCM token saved successfully!', { data });
      currentTokenRef.current = token;
      return true;
    } catch (error) {
      debugLog('Exception while saving FCM token', error);
      console.error('Error saving FCM token:', error);
      return false;
    }
  }, [platform]);

  // Handle notification received while app is in foreground
  const handleNotificationReceived = useCallback((notification: { title?: string; body?: string; data?: Record<string, unknown> }) => {
    debugLog('Push notification received in foreground', notification);
    
    // Show a toast notification when app is in foreground
    const title = notification.title || 'Nouvelle notification';
    const body = notification.body || '';
    
    toast.info(title, {
      description: body,
      duration: 8000,
      action: notification.data?.url ? {
        label: 'Voir',
        onClick: () => {
          const url = notification.data?.url as string;
          if (url.startsWith('/')) {
            navigate(url);
          } else {
            window.location.href = url;
          }
        },
      } : undefined,
    });

    // Play notification sound
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // Audio not supported
    }
  }, [navigate]);

  // Handle notification tap/action
  const handleNotificationAction = useCallback((notification: { notification: { data?: Record<string, unknown> } }) => {
    debugLog('Push notification action performed', notification);
    
    const data = notification.notification.data;
    if (data?.url) {
      const url = data.url as string;
      if (url.startsWith('/')) {
        navigate(url);
      } else {
        window.location.href = url;
      }
    } else if (data?.interventionId) {
      navigate('/');
    } else if (data?.type === 'chat') {
      navigate('/chat');
    } else if (data?.type === 'news') {
      navigate('/news');
    } else if (data?.type === 'login') {
      navigate('/employees');
    }
  }, [navigate]);

  // Initialize push notifications
  const initializePushNotifications = useCallback(async () => {
    if (!isNative) {
      debugLog('Not a native app, skipping push initialization');
      return;
    }

    if (isInitializedRef.current) {
      debugLog('Push notifications already initialized');
      return;
    }

    debugLog('Initializing push notifications...', { platform });

    try {
      // Dynamic import to avoid errors on web
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Step 1: Request permission
      debugLog('Requesting push notification permissions...');
      const permResult = await PushNotifications.requestPermissions();
      debugLog('Permission result', permResult);

      if (permResult.receive !== 'granted') {
        debugLog('Push notification permission denied');
        console.log('Push notification permission denied by user');
        return;
      }

      debugLog('Permission granted!');

      // Step 2: Attach listeners BEFORE calling register() (critical for race conditions)
      if (!listenersAttachedRef.current) {
        debugLog('Attaching push notification listeners...');

        // Registration success listener
        await PushNotifications.addListener('registration', async (token) => {
          // Log the FULL token for Firebase testing - easy to copy from console
          console.log('═══════════════════════════════════════════════════════════');
          console.log('🔔 FCM/APNs TOKEN RECEIVED - COPY THIS FOR FIREBASE TESTING:');
          console.log('═══════════════════════════════════════════════════════════');
          console.log(token.value);
          console.log('═══════════════════════════════════════════════════════════');
          
          debugLog('FCM/APNs token received!', { 
            tokenLength: token.value?.length,
            platform
          });
          
          // If user is already logged in, save the token immediately
          if (user?.id) {
            await saveFcmToken(user.id, token.value);
          } else {
            // Store token temporarily, will be saved when user logs in
            currentTokenRef.current = token.value;
            debugLog('Token stored, waiting for user authentication to save');
          }
        });

        // Registration error listener
        await PushNotifications.addListener('registrationError', (error) => {
          debugLog('Push registration error!', error);
          console.error('Push registration error:', error);
        });

        // Notification received while app is in foreground
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          handleNotificationReceived({
            title: notification.title,
            body: notification.body,
            data: notification.data,
          });
        });

        // Notification tapped/action performed
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          handleNotificationAction(action);
        });

        listenersAttachedRef.current = true;
        debugLog('All push notification listeners attached');
      }

      // Step 3: Register with APNs/FCM
      debugLog('Calling PushNotifications.register()...');
      await PushNotifications.register();
      debugLog('PushNotifications.register() called successfully');

      isInitializedRef.current = true;
      debugLog('Push notifications initialization complete');

    } catch (error) {
      debugLog('Error during push notification initialization', error);
      console.error('Error initializing push notifications:', error);
    }
  }, [isNative, platform, user?.id, saveFcmToken, handleNotificationReceived, handleNotificationAction]);

  // Initialize on app launch (for native apps)
  useEffect(() => {
    if (isNative && !isInitializedRef.current) {
      // Small delay to ensure app is fully loaded
      const timer = setTimeout(() => {
        initializePushNotifications();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isNative, initializePushNotifications]);

  // Save token when user becomes authenticated
  useEffect(() => {
    if (user?.id && currentTokenRef.current && isNative) {
      debugLog('User authenticated, saving stored token...', { userId: user.id });
      saveFcmToken(user.id, currentTokenRef.current);
    }
  }, [user?.id, isNative, saveFcmToken]);

  // Re-register token on user login (ensures token is always up to date)
  useEffect(() => {
    if (user?.id && isNative && isInitializedRef.current) {
      // Force a new registration to ensure fresh token
      const refreshToken = async () => {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          debugLog('Refreshing FCM token for authenticated user...');
          await PushNotifications.register();
        } catch (error) {
          debugLog('Error refreshing token', error);
        }
      };
      
      // Small delay to avoid race conditions
      const timer = setTimeout(refreshToken, 500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, isNative]);

  return <>{children}</>;
};

export default NativePushProvider;

import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Debug logging helper
function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const prefix = `[FCM Debug ${timestamp}]`;
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

// Check if we're running in a native Capacitor environment
export function isNativeApp(): boolean {
  const isNative = Capacitor.isNativePlatform();
  debugLog(`isNativeApp() called`, { isNative, platform: Capacitor.getPlatform() });
  return isNative;
}

// Get the current platform
export function getPlatform(): "ios" | "android" | "web" {
  const platform = Capacitor.getPlatform();
  debugLog(`getPlatform() called`, { platform });
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  return "web";
}

// Dynamic import for PushNotifications to avoid errors on web
async function getPushNotificationsPlugin() {
  debugLog("getPushNotificationsPlugin() called");
  
  if (!isNativeApp()) {
    debugLog("Not a native app, returning null");
    return null;
  }
  
  try {
    debugLog("Attempting to import @capacitor/push-notifications...");
    const { PushNotifications } = await import("@capacitor/push-notifications");
    debugLog("PushNotifications plugin imported successfully", { PushNotifications: !!PushNotifications });
    return PushNotifications;
  } catch (error) {
    debugLog("Failed to import PushNotifications plugin", error);
    console.error("Failed to import PushNotifications plugin:", error);
    return null;
  }
}

// Register for native push notifications
export async function registerNativePush(userId: string): Promise<boolean> {
  debugLog("registerNativePush() called", { userId });
  
  if (!isNativeApp()) {
    debugLog("Not a native app, skipping native push registration");
    console.log("Not a native app, skipping native push registration");
    return false;
  }

  const PushNotifications = await getPushNotificationsPlugin();
  if (!PushNotifications) {
    debugLog("PushNotifications plugin not available");
    console.error("PushNotifications plugin not available");
    return false;
  }

  try {
    // Request permission
    debugLog("Requesting push notification permissions...");
    const permissionResult = await PushNotifications.requestPermissions();
    debugLog("Permission result", permissionResult);

    if (permissionResult.receive !== "granted") {
      debugLog("Push notification permission denied", permissionResult);
      console.log("Push notification permission denied");
      return false;
    }

    debugLog("Permission granted, setting up listeners...");

    // IMPORTANT: attach listeners BEFORE calling register().
    // On some devices the "registration" event can fire immediately.
    return await new Promise((resolve) => {
      let settled = false;
      let timeoutId: number | undefined;

      const settle = async (ok: boolean, reason?: string) => {
        if (settled) return;
        settled = true;
        debugLog(`Registration settled`, { success: ok, reason });
        if (typeof timeoutId === "number") window.clearTimeout(timeoutId);
        try {
          // Best-effort cleanup to avoid stacking listeners across app opens.
          await Promise.all([
            registrationHandle?.remove?.(),
            registrationErrorHandle?.remove?.(),
            receivedHandle?.remove?.(),
            actionHandle?.remove?.(),
          ]);
          debugLog("Listeners cleaned up");
        } catch (cleanupError) {
          debugLog("Error cleaning up listeners", cleanupError);
        }
        resolve(ok);
      };

      debugLog("Adding 'registration' listener...");
      const registrationHandlePromise = PushNotifications.addListener("registration", async (token) => {
        debugLog("FCM/APNs token received!", { tokenLength: token.value?.length, tokenPreview: token.value?.substring(0, 20) + "..." });
        console.log("FCM/APNs token received:", token.value);
        const saved = await saveFcmToken(userId, token.value);
        debugLog("Token save result", { saved });
        await settle(saved, saved ? "token_saved" : "token_save_failed");
      });

      debugLog("Adding 'registrationError' listener...");
      const registrationErrorHandlePromise = PushNotifications.addListener("registrationError", async (error) => {
        debugLog("Push registration error!", error);
        console.error("Push registration error:", error);
        await settle(false, "registration_error");
      });

      // Set up notification listeners (these don't block registration)
      debugLog("Adding 'pushNotificationReceived' listener...");
      const receivedHandlePromise = PushNotifications.addListener("pushNotificationReceived", (notification) => {
        debugLog("Push notification received", notification);
        console.log("Push notification received:", notification);
      });

      debugLog("Adding 'pushNotificationActionPerformed' listener...");
      const actionHandlePromise = PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
        debugLog("Push notification action performed", notification);
        console.log("Push notification action performed:", notification);
        const data = notification.notification.data;
        if (data?.url) {
          window.location.href = data.url;
        } else if (data?.interventionId) {
          window.location.href = `/`;
        }
      });

      // Resolve listener handles for cleanup
      let registrationHandle: any;
      let registrationErrorHandle: any;
      let receivedHandle: any;
      let actionHandle: any;

      Promise.all([registrationHandlePromise, registrationErrorHandlePromise, receivedHandlePromise, actionHandlePromise])
        .then(([h1, h2, h3, h4]) => {
          registrationHandle = h1;
          registrationErrorHandle = h2;
          receivedHandle = h3;
          actionHandle = h4;
          debugLog("All listeners attached successfully");
        })
        .catch((listenerError) => {
          debugLog("Error attaching listeners", listenerError);
        });

      // Timeout so we don't hang forever if the platform never returns a token
      timeoutId = window.setTimeout(() => {
        debugLog("Native push registration timed out after 15s");
        console.error("Native push registration timed out");
        void settle(false, "timeout");
      }, 15000);

      // Register with APNs/FCM AFTER listeners are attached
      debugLog("Calling PushNotifications.register()...");
      PushNotifications.register()
        .then(() => {
          debugLog("PushNotifications.register() returned successfully (waiting for token event)");
        })
        .catch((err) => {
          debugLog("PushNotifications.register() failed", err);
          console.error("PushNotifications.register() failed:", err);
          void settle(false, "register_call_failed");
        });
    });
  } catch (error) {
    debugLog("Error in registerNativePush", error);
    console.error("Error registering for native push:", error);
    return false;
  }
}

// Save FCM token to database
async function saveFcmToken(userId: string, token: string): Promise<boolean> {
  debugLog("saveFcmToken() called", { userId, tokenLength: token?.length });
  const platform = getPlatform();
  
  if (platform === "web") {
    debugLog("Web platform detected, not saving FCM token");
    console.log("Web platform, not saving FCM token");
    return false;
  }

  try {
    debugLog("Attempting to upsert FCM token to database...", { platform });
    
    // Upsert the token (update if exists, insert if new)
    const { error, data } = await supabase
      .from("fcm_tokens")
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,token",
        }
      )
      .select();

    if (error) {
      debugLog("Error saving FCM token", error);
      console.error("Error saving FCM token:", error);
      return false;
    }

    debugLog("FCM token saved successfully!", { data });
    console.log("FCM token saved successfully");
    return true;
  } catch (error) {
    debugLog("Exception while saving FCM token", error);
    console.error("Error saving FCM token:", error);
    return false;
  }
}

// Remove FCM token from database
export async function unregisterNativePush(userId: string): Promise<boolean> {
  if (!isNativeApp()) {
    return false;
  }

  try {
    const { error } = await supabase
      .from("fcm_tokens")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("Error removing FCM token:", error);
      return false;
    }

    console.log("FCM token removed successfully");
    return true;
  } catch (error) {
    console.error("Error removing FCM token:", error);
    return false;
  }
}

// Initialize native push for current user
export async function initializeNativePush(userId: string): Promise<void> {
  debugLog("initializeNativePush() called", { userId });
  
  if (!isNativeApp()) {
    debugLog("Not a native app, skipping initialization");
    return;
  }

  debugLog("Starting native push initialization...");
  console.log("Initializing native push notifications...");
  const success = await registerNativePush(userId);
  
  if (success) {
    debugLog("Native push notifications initialized successfully!");
    console.log("Native push notifications initialized successfully");
  } else {
    debugLog("Failed to initialize native push notifications");
    console.log("Failed to initialize native push notifications");
  }
}

// Check if native push is available and registered
export async function checkNativePushStatus(): Promise<{
  available: boolean;
  registered: boolean;
  platform: string;
}> {
  if (!isNativeApp()) {
    return { available: false, registered: false, platform: "web" };
  }

  const PushNotifications = await getPushNotificationsPlugin();
  if (!PushNotifications) {
    return { available: false, registered: false, platform: getPlatform() };
  }

  try {
    const permStatus = await PushNotifications.checkPermissions();
    return {
      available: true,
      registered: permStatus.receive === "granted",
      platform: getPlatform(),
    };
  } catch (error) {
    console.error("Error checking native push status:", error);
    return { available: false, registered: false, platform: getPlatform() };
  }
}

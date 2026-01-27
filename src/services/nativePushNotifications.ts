import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Check if we're running in a native Capacitor environment
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

// Get the current platform
export function getPlatform(): "ios" | "android" | "web" {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  return "web";
}

// Dynamic import for PushNotifications to avoid errors on web
async function getPushNotificationsPlugin() {
  if (!isNativeApp()) {
    return null;
  }
  
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    return PushNotifications;
  } catch (error) {
    console.error("Failed to import PushNotifications plugin:", error);
    return null;
  }
}

// Register for native push notifications
export async function registerNativePush(userId: string): Promise<boolean> {
  if (!isNativeApp()) {
    console.log("Not a native app, skipping native push registration");
    return false;
  }

  const PushNotifications = await getPushNotificationsPlugin();
  if (!PushNotifications) {
    console.error("PushNotifications plugin not available");
    return false;
  }

  try {
    // Request permission
    const permissionResult = await PushNotifications.requestPermissions();

    if (permissionResult.receive !== "granted") {
      console.log("Push notification permission denied");
      return false;
    }

    // IMPORTANT: attach listeners BEFORE calling register().
    // On some devices the "registration" event can fire immediately.
    return await new Promise((resolve) => {
      let settled = false;
      let timeoutId: number | undefined;

      const settle = async (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (typeof timeoutId === "number") window.clearTimeout(timeoutId);
        try {
          // Best-effort cleanup to avoid stacking listeners across app opens.
          await Promise.all([
            registrationHandle?.remove?.(),
            registrationErrorHandle?.remove?.(),
            receivedHandle?.remove?.(),
            actionHandle?.remove?.(),
          ]);
        } catch {
          // ignore
        }
        resolve(ok);
      };

      const registrationHandlePromise = PushNotifications.addListener("registration", async (token) => {
        console.log("FCM/APNs token received:", token.value);
        const saved = await saveFcmToken(userId, token.value);
        await settle(saved);
      });

      const registrationErrorHandlePromise = PushNotifications.addListener("registrationError", async (error) => {
        console.error("Push registration error:", error);
        await settle(false);
      });

      // Set up notification listeners (these don't block registration)
      const receivedHandlePromise = PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Push notification received:", notification);
      });

      const actionHandlePromise = PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
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
        })
        .catch(() => {
          // ignore
        });

      // Timeout so we don't hang forever if the platform never returns a token
      timeoutId = window.setTimeout(() => {
        console.error("Native push registration timed out");
        void settle(false);
      }, 15000);

      // Register with APNs/FCM AFTER listeners are attached
      PushNotifications.register().catch((err) => {
        console.error("PushNotifications.register() failed:", err);
        void settle(false);
      });
    });
  } catch (error) {
    console.error("Error registering for native push:", error);
    return false;
  }
}

// Save FCM token to database
async function saveFcmToken(userId: string, token: string): Promise<boolean> {
  const platform = getPlatform();
  
  if (platform === "web") {
    console.log("Web platform, not saving FCM token");
    return false;
  }

  try {
    // Upsert the token (update if exists, insert if new)
    const { error } = await supabase
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
      );

    if (error) {
      console.error("Error saving FCM token:", error);
      return false;
    }

    console.log("FCM token saved successfully");
    return true;
  } catch (error) {
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
  if (!isNativeApp()) {
    return;
  }

  console.log("Initializing native push notifications...");
  const success = await registerNativePush(userId);
  
  if (success) {
    console.log("Native push notifications initialized successfully");
  } else {
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

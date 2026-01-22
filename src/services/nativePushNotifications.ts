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

    // Register with APNs/FCM
    await PushNotifications.register();

    // Listen for registration
    return new Promise((resolve) => {
      PushNotifications.addListener("registration", async (token) => {
        console.log("FCM/APNs token received:", token.value);
        
        // Save token to database
        const saved = await saveFcmToken(userId, token.value);
        resolve(saved);
      });

      PushNotifications.addListener("registrationError", (error) => {
        console.error("Push registration error:", error);
        resolve(false);
      });

      // Set up notification listeners
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Push notification received:", notification);
        // You can show a local notification or update UI here
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
        console.log("Push notification action performed:", notification);
        // Handle notification tap - navigate to appropriate page
        const data = notification.notification.data;
        if (data?.url) {
          window.location.href = data.url;
        } else if (data?.interventionId) {
          window.location.href = `/`;
        }
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

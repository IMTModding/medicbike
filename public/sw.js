// Service Worker for MEDICBIKE
// Intentionally NO caching logic here to avoid white-screen issues caused by stale caches.
// Responsibilities:
// - Take control quickly (skipWaiting + clientsClaim)
// - Handle push notifications

self.addEventListener("install", function () {
  // Don't force activate immediately; we let the app trigger it via SKIP_WAITING.
  // This avoids update/reload loops on some mobile browsers.
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", function (event) {
  console.log("[SW] Push received at:", new Date().toISOString());
  
  var data = {
    title: "Nouvelle intervention",
    body: "Une nouvelle alerte a été créée",
    icon: "/pwa-192x192.png",
    badge: "/notification-badge.png",
    tag: "intervention-" + Date.now(),
    data: { url: "/" },
  };

  try {
    if (event.data) {
      var payload = event.data.json();
      console.log("[SW] Push payload:", JSON.stringify(payload));
      data = Object.assign({}, data, payload);
    }
  } catch (e) {
    console.error("[SW] Error parsing push data:", e);
    // Try text parsing as fallback
    try {
      var textData = event.data ? event.data.text() : null;
      console.log("[SW] Raw push text:", textData);
    } catch (e2) {
      console.error("[SW] Error reading push text:", e2);
    }
  }

  var options = {
    body: data.body || "Nouvelle notification",
    icon: data.icon || "/pwa-192x192.png",
    badge: data.badge || "/notification-badge.png",
    tag: data.tag || ("notification-" + Date.now()),
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: data.requireInteraction !== false,
    renotify: true,
    silent: false,
    data: data.data || { url: "/" },
    actions: [
      { action: "open", title: "Ouvrir" },
      { action: "close", title: "Fermer" }
    ]
  };

  console.log("[SW] Showing notification:", data.title, "options:", JSON.stringify(options));
  
  event.waitUntil(
    self.registration.showNotification(data.title || "Notification", options)
      .then(function() {
        console.log("[SW] Notification shown successfully");
      })
      .catch(function(err) {
        console.error("[SW] Failed to show notification:", err);
      })
  );
});

self.addEventListener("notificationclick", function (event) {
  console.log("[SW] Notification clicked:", event.action);
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  var url = "/";
  if (event.notification.data) {
    url = event.notification.data.url || "/";
    // If it's an intervention, go to home to see it
    if (event.notification.data.interventionId) {
      url = "/";
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // Check if any window is already open
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if (client.navigate) {
            return client.navigate(url);
          }
          return;
        }
      }
      // No window open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

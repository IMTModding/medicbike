// Service Worker for MEDICBIKE PWA
// Supports:
// - Workbox precaching (injected at build time)
// - Push notifications
// - Immediate activation on updates

// Load Workbox (CDN)
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

// @ts-ignore
var wb = self.workbox;

if (wb) {
  // Ensure new SW takes control ASAP
  wb.core.skipWaiting();
  wb.core.clientsClaim();

  // Precache app shell/assets (manifest injected by vite-plugin-pwa)
  wb.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // Navigation requests: try network first, fall back to cached app shell
  wb.routing.registerRoute(
    function(options) { return options.request.mode === "navigate"; },
    new wb.strategies.NetworkFirst({
      cacheName: "pages",
      networkTimeoutSeconds: 3,
    })
  );

  // API calls to backend: network first with short cache
  wb.routing.registerRoute(
    function(options) { return options.url.origin.includes("supabase.co"); },
    new wb.strategies.NetworkFirst({
      cacheName: "backend",
      networkTimeoutSeconds: 5,
    })
  );
}

self.addEventListener("message", function(event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", function(event) {
  var data = {
    title: "Nouvelle intervention",
    body: "Une nouvelle alerte a été créée",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "intervention",
    data: { url: "/" },
  };

  try {
    if (event.data) {
      var payload = event.data.json();
      data = Object.assign({}, data, payload);
    }
  } catch (e) {
    // ignore
  }

  var options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: data.data,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  var url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

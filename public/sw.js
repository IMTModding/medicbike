// Service Worker for MEDICBIKE
// Intentionally NO caching logic here to avoid white-screen issues caused by stale caches.
// Responsibilities:
// - Take control quickly (skipWaiting + clientsClaim)
// - Handle push notifications

self.addEventListener("install", function () {
  self.skipWaiting();
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

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
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

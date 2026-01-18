/// <reference lib="webworker" />

// This service worker is the SINGLE SW used by the app.
// It supports:
// - Workbox precaching (injected at build time)
// - Push notifications
// - Immediate activation on updates

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST?: any;
};

// Load Workbox (CDN)
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

// @ts-ignore
const wb = (self as any).workbox;

if (wb) {
  // Ensure new SW takes control ASAP
  wb.core.skipWaiting();
  wb.core.clientsClaim();

  // Precache app shell/assets (manifest injected by vite-plugin-pwa)
  wb.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // Navigation requests: try network first, fall back to cached app shell
  wb.routing.registerRoute(
    ({ request }) => request.mode === "navigate",
    new wb.strategies.NetworkFirst({
      cacheName: "pages",
      networkTimeoutSeconds: 3,
    })
  );

  // API calls to backend: network first with short cache
  wb.routing.registerRoute(
    ({ url }) => url.origin.includes("supabase.co"),
    new wb.strategies.NetworkFirst({
      cacheName: "backend",
      networkTimeoutSeconds: 5,
    })
  );
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Nouvelle intervention",
    body: "Une nouvelle alerte a été créée",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "intervention",
    data: { url: "/" },
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch {
    // ignore
  }

  const options: NotificationOptions = {
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification as any).data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return (client as WindowClient).focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

export {};


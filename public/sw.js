// Minimal service worker — its presence (with a fetch handler) makes the
// app installable so Chrome/Android fires the beforeinstallprompt event.
// No offline caching here; requests pass straight through to the network.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through: let the browser handle the request normally.
});

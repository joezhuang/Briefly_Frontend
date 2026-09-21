self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network behavior intentionally stays browser-native. This service worker exists
  // only to support installability; Briefly does not cache news content here.
});

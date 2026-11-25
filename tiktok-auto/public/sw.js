// Service worker minimum supaya boleh "Add to Home Screen". Tiada cache data (admin sentiasa data terkini).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

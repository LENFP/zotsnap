// ZotSnap service worker: cache the app shell so it opens instantly and offline.
// Zotero API calls (different origin) pass through untouched.
const CACHE = "zotsnap-v1";

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./"])));
});

self.addEventListener("activate", e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const fresh = fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});

// Service worker: keeps the pages needed to fill in a report available offline.
// Bump VERSION when this file changes in a way that needs the old caches gone.
const VERSION = "v1";
const PAGE_CACHE = `pages-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/** Pages kept for offline use. Other pages show the offline notice. */
const OFFLINE_PAGES = ["/", "/culto/novo", "/pendentes"];
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];
/** Hashed build files accumulate across deploys; start over past this size. */
const MAX_STATIC_ENTRIES = 400;
/** On weak signal, fall back to the saved page instead of waiting forever. */
const NAV_TIMEOUT_MS = 6000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGE_CACHE, STATIC_CACHE]);
      for (const key of await caches.keys()) {
        if (!keep.has(key) && (key.startsWith("pages-") || key.startsWith("static-"))) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "warm") event.waitUntil(warm());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Hashed, immutable build files (JS, CSS, fonts).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(navigate(req, url));
    return;
  }
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
  }
  // Everything else (API calls, RSC requests) goes straight to the network.
  // When an RSC request fails, Next falls back to a full page load, handled above.
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

function isOfflinePage(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return OFFLINE_PAGES.includes(path) ? path : null;
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function navigate(req, url) {
  const page = isOfflinePage(url.pathname);
  try {
    const res = await (page ? Promise.race([fetch(req), timeout(NAV_TIMEOUT_MS)]) : fetch(req));
    // Only keep real pages: not the login redirect, not errors.
    if (page && res.ok && !res.redirected) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(page, res.clone());
    }
    return res;
  } catch {
    if (page) {
      const cached = await caches.match(page, { cacheName: PAGE_CACHE });
      if (cached) return cached;
    }
    return (await caches.match(OFFLINE_URL)) ?? Response.error();
  }
}

const ASSET_RE = /\/_next\/static\/[^"'\s)\\]+/g;

/** Downloads the offline pages and every build file they reference. */
async function warm() {
  const statics = await caches.open(STATIC_CACHE);
  if ((await statics.keys()).length > MAX_STATIC_ENTRIES) {
    await caches.delete(STATIC_CACHE);
  }
  const pages = await caches.open(PAGE_CACHE);
  const assets = new Set();

  for (const page of OFFLINE_PAGES) {
    try {
      const res = await fetch(page, { credentials: "same-origin", cache: "no-store" });
      // Logged out: the server redirects to /login. Keep what we had.
      if (!res.ok || res.redirected) continue;
      const html = await res.clone().text();
      await pages.put(page, res);
      for (const m of html.matchAll(ASSET_RE)) assets.add(m[0]);
    } catch {
      return; // offline: try again next time
    }
  }

  const cache = await caches.open(STATIC_CACHE);
  for (const path of assets) {
    if (await cache.match(path)) continue;
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      // Stylesheets reference fonts with url(...).
      if (path.endsWith(".css")) {
        for (const m of (await res.clone().text()).matchAll(ASSET_RE)) {
          if (!assets.has(m[0])) assets.add(m[0]);
        }
      }
      await cache.put(path, res);
    } catch {
      return;
    }
  }
}

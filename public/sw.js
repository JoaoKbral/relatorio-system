// Service worker: keeps the pages needed to fill in a report available offline.
// Bump VERSION when this file changes in a way that needs the old caches gone.
const VERSION = "v1";
const PAGE_CACHE = `pages-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/** Pages kept for offline use. Other pages show the offline notice. */
const OFFLINE_PAGES = ["/", "/culto/novo", "/pendentes"];
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];
/** Hashed build files accumulate across deploys; past this, unused ones are removed. */
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

/**
 * Downloads the offline pages and every build file they reference.
 * All or nothing: the saved pages are only replaced, and old build files only
 * removed, once every file the new pages need is on the device. A connection
 * that drops halfway must never leave a saved page pointing at missing files.
 */
async function warm() {
  const fresh = []; // [path, Response] of pages not saved yet
  const assets = new Set();

  for (const page of OFFLINE_PAGES) {
    let res;
    try {
      res = await fetch(page, { credentials: "same-origin", cache: "no-store" });
    } catch {
      return; // offline: keep everything as it is, try again next time
    }
    // Logged out: the server redirects to /login. Keep what we had.
    if (!res.ok || res.redirected) continue;
    const html = await res.clone().text();
    for (const m of html.matchAll(ASSET_RE)) assets.add(m[0]);
    fresh.push([page, res]);
  }
  if (fresh.length === 0) return;

  const statics = await caches.open(STATIC_CACHE);
  // A Set visits entries added during the loop: fonts found in CSS get fetched too.
  for (const path of assets) {
    let res = await statics.match(path);
    if (!res) {
      try {
        res = await fetch(path);
      } catch {
        return; // dropped halfway: old pages and files stay untouched
      }
      if (!res.ok) continue;
      await statics.put(path, res.clone());
    }
    // Stylesheets reference fonts with url(...).
    if (path.endsWith(".css")) {
      for (const m of (await res.text()).matchAll(ASSET_RE)) assets.add(m[0]);
    }
  }

  const pages = await caches.open(PAGE_CACHE);
  for (const [page, res] of fresh) await pages.put(page, res);

  // Hashed files pile up across deploys. Past the limit, drop the ones no
  // saved page uses any more. Only when every page was refreshed: an old copy
  // left in place still needs its old files, which are not in `assets`.
  const keys = await statics.keys();
  if (fresh.length === OFFLINE_PAGES.length && keys.length > MAX_STATIC_ENTRIES) {
    for (const req of keys) {
      const path = new URL(req.url).pathname;
      if (path.startsWith("/_next/static/") && !assets.has(path)) await statics.delete(req);
    }
  }
}

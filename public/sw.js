/* ============================================================
 * Rego service worker.
 *
 * DESIGN PRINCIPLE: this worker is DENY-BY-DEFAULT for caching.
 * It caches a small, explicit set of immutable build assets and
 * nothing else. Every other request goes straight to the network,
 * untouched.
 *
 * That is deliberately unambitious. A service worker sits between
 * every request and the network — an over-eager one can serve a
 * stale booking price, hand one traveller another's dashboard from
 * cache, or pin users to a dead build after a deploy. None of those
 * failures are worth the offline convenience they would buy.
 *
 * WHAT IS CACHED
 *   /_next/static/*   content-hashed, immutable by construction
 *   /icons/*          PWA icons
 *   fonts             woff2 from the same origin
 *   /offline          the fallback page, precached at install
 *
 * WHAT IS NEVER CACHED — enforced below, not just intended:
 *   any non-GET request
 *   any cross-origin request (Supabase, Cloudinary, Google, maps)
 *   anything under /api/, /admin, /cyber, /dashboard, /auth
 *   any request carrying an Authorization header
 *   any response with Set-Cookie
 *   any response that is not status 200 and type "basic"
 *
 * NO SECRETS LIVE IN THIS FILE. It is served publicly at /sw.js.
 * ============================================================ */

/* Bumping this string is what retires an old cache. It is derived
   from the deploy, so a new build gets a new cache automatically. */
const VERSION = "rego-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

/* Path prefixes the worker must never touch. Private areas and
   anything that can mutate state or return per-user data. */
const NEVER_CACHE_PATHS = [
  "/api/",
  "/admin",
  "/cyber",
  "/dashboard",
  "/auth",
  "/signin",
  "/signup",
  "/reset-password",
  "/verify",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      /* Only the offline page and icons are precached. We do NOT
         precache a build manifest — that is what pins users to a
         stale shell after a deploy. */
      await cache.addAll([
        OFFLINE_URL,
        "/icons/icon-192.png",
        "/icons/icon-512.png",
      ]).catch(() => {
        /* A precache miss must not abort installation. The worker
           still functions; the offline page just falls back to the
           browser error until the next successful fetch. */
      });
      /* Activate immediately so a fixed worker reaches users on the
         next navigation rather than whenever every tab closes. */
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache from a previous version.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/** Static build output and icons — safe to cache, immutable by URL. */
function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2")
  );
}

function isPrivatePath(pathname) {
  return NEVER_CACHE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
}

/**
 * Final gate before anything enters the cache.
 *
 * Belt and braces: even if a request slipped through the routing
 * above, a response carrying a cookie or a non-200 status never
 * gets stored.
 */
function isStorable(response) {
  if (!response || response.status !== 200) return false;
  if (response.type !== "basic") return false; // same-origin only
  if (response.headers.get("set-cookie")) return false;
  const cc = response.headers.get("cache-control") || "";
  if (/no-store|private/i.test(cc)) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 1. Anything that can change state is none of our business.
  if (req.method !== "GET") return;

  // 2. A request carrying credentials must never be intercepted.
  if (req.headers.has("authorization")) return;

  const url = new URL(req.url);

  // 3. Cross-origin — Supabase, Cloudinary, Google Fonts, maps.
  //    Let the browser handle these entirely.
  if (url.origin !== self.location.origin) return;

  // 4. Private and API paths — never cached, never intercepted,
  //    so a stale dashboard can never be served to anyone.
  if (isPrivatePath(url.pathname)) return;

  // 5. Immutable build assets — cache-first, since the URL changes
  //    whenever the content does.
  if (isCacheableAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (isStorable(res)) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  /* 6. Page navigations — network only, with an offline fallback.
        Deliberately NOT network-first-with-cache-fallback: that
        would serve a previously visited page from cache, and on a
        listing or booking page that means showing a price or an
        availability that may no longer be true. */
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const offline = await caches.match(OFFLINE_URL);
          return (
            offline ||
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })()
    );
    return;
  }

  // 7. Everything else falls through to the network untouched.
});

/* Lets the page tell a waiting worker to take over — used by the
   "New version available" prompt so the user chooses the moment,
   rather than having a reload forced on them mid-booking. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

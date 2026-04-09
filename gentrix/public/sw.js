/* Portal PWA — shell-cache voor /_next/static, offline fallback voor navigatie. Geen API-cache. */
const CACHE_NAME = "portal-app-v3";

self.addEventListener("push", (event) => {
  let payload = { title: "Nieuwe afspraak", body: "Open het portaal voor details.", url: "/" };
  try {
    if (event.data) {
      const j = event.data.json();
      if (j && typeof j === "object") payload = { ...payload, ...j };
    }
  } catch (_) {
    /* ignore */
  }
  const url = typeof payload.url === "string" ? payload.url : self.location.origin;
  event.waitUntil(
    self.registration.showNotification(String(payload.title), {
      body: String(payload.body),
      data: { url },
      tag: "portal-appt",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  const target =
    typeof raw === "string" && (raw.startsWith("http://") || raw.startsWith("https://"))
      ? raw
      : `${self.location.origin}/home`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if (c.url.startsWith(target.split("?")[0]) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});

/** Op localhost geen fetch intercept: voorkomt kale pagina’s (Tailwind/CSS) door oude cache of dev asset-blokkades. */
function isLocalDevHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

const OFFLINE_HTML = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="theme-color" content="#18181b"/><title>Offline</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fafafa;color:#18181b;padding:1.5rem;text-align:center}p{max-width:22rem;line-height:1.55;font-size:0.95rem}</style></head><body><p><strong>Geen verbinding.</strong> Controleer je internet en open het portaal opnieuw.</p></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (isLocalDevHostname(url.hostname)) return;

  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticCacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigate(request));
  }
});

async function staticCacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch (e) {
    return cached ?? new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

async function networkFirstNavigate(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(OFFLINE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

import type { PostHog } from "posthog-js";
import type {
  GentrixAnalyticsContext,
  GentrixEventName,
  GentrixScrollDepth,
} from "@/lib/analytics/schema";

let posthogClient: PostHog | null = null;
let loadStarted = false;
let lastRegisteredJson = "";

const defaultContext: GentrixAnalyticsContext = {
  session_type: "other",
  site_slug: null,
  page_key: null,
  booking_module_enabled: false,
  webshop_module_enabled: false,
  is_preview: false,
  app_environment: process.env.NODE_ENV === "development" ? "development" : "production",
  is_internal_actor: false,
  actor: "unknown",
  render_surface: "other",
};

type MutableContext = typeof defaultContext;
let current = { ...defaultContext };

const pendingPageviews: string[] = [];
type PendingTrack = { name: GentrixEventName; properties?: Record<string, string | number | boolean | null | undefined> };
const pendingTracks: PendingTrack[] = [];
let pendingIdentify: { userId: string; traits?: Record<string, string | number | boolean | null> } | null = null;
let registerDirty = true;

function envKey() {
  return (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").trim();
}

export function isGentrixAnalyticsEnabled(): boolean {
  return envKey().length > 0;
}

function scheduleIdleLoad(run: () => void): void {
  if (typeof window === "undefined") return;
  const ric = window.requestIdleCallback?.bind(window);
  if (typeof ric === "function") {
    ric(() => run(), { timeout: 4000 });
  } else {
    window.setTimeout(run, 200);
  }
}

function ctxPayload(): Record<string, string | number | boolean | null> {
  const c = current;
  return {
    session_type: c.session_type,
    site_slug: c.site_slug,
    page_key: c.page_key,
    booking_module_enabled: c.booking_module_enabled,
    webshop_module_enabled: c.webshop_module_enabled,
    is_preview: c.is_preview,
    app_environment: c.app_environment,
    is_internal_actor: c.is_internal_actor,
    actor: c.actor,
    render_surface: c.render_surface,
  };
}

function syncRegisterToPosthog(): void {
  if (!posthogClient) return;
  const forRegister: Record<string, string | number | boolean | null> = {
    session_type: current.session_type,
    site_slug: current.site_slug,
    page_key: current.page_key,
    booking_module_enabled: current.booking_module_enabled,
    webshop_module_enabled: current.webshop_module_enabled,
    is_preview: current.is_preview,
    app_environment: current.app_environment,
    is_internal_actor: current.is_internal_actor,
    actor: current.actor,
    render_surface: current.render_surface,
  };
  const asJson = JSON.stringify(forRegister);
  if (asJson === lastRegisteredJson) return;
  lastRegisteredJson = asJson;
  try {
    posthogClient.register(forRegister);
  } catch {
    /* ignore */
  }
}

function flushPosthogQueue(): void {
  if (!posthogClient) return;
  if (registerDirty) {
    registerDirty = false;
    syncRegisterToPosthog();
  }
  if (pendingIdentify) {
    const { userId, traits } = pendingIdentify;
    pendingIdentify = null;
    try {
      posthogClient.identify(userId, traits ?? undefined);
    } catch {
      /* ignore */
    }
  }
  for (const path of pendingPageviews.splice(0, pendingPageviews.length)) {
    try {
      const href = typeof window !== "undefined" ? window.location.href : path;
      posthogClient.capture("$pageview", { ...ctxPayload(), $current_url: href, path });
    } catch {
      /* ignore */
    }
  }
  for (const t of pendingTracks.splice(0, pendingTracks.length)) {
    const rest: Record<string, string | number | boolean> = {};
    if (t.properties) {
      for (const [k, v] of Object.entries(t.properties)) {
        if (v === undefined) continue;
        if (v === null) {
          rest[k] = "";
          continue;
        }
        rest[k] = v;
      }
    }
    try {
      posthogClient.capture(String(t.name), { ...ctxPayload(), ...rest });
    } catch {
      /* ignore */
    }
  }
}

function startPosthogLoad(): void {
  if (typeof window === "undefined" || loadStarted) return;
  const key = envKey();
  if (!key) return;
  loadStarted = true;
  scheduleIdleLoad(() => {
    void import("posthog-js")
      .then((mod) => {
        const ph = mod.default;
        const host =
          (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com").trim() || "https://eu.i.posthog.com";
        ph.init(key, {
          api_host: host,
          person_profiles: "identified_only",
          capture_pageview: false,
          capture_pageleave: true,
          persistence: "localStorage",
          /** Mobiel: geen rrweb + recorder (~50+ KiB), minder lange main-thread taken. */
          disable_session_recording: true,
          /** Vermijdt extra bundels (web-vitals, dead-clicks) die Lighthouse als duplicaat/CPU-tijd toont. */
          capture_dead_clicks: false,
          capture_performance: false,
          loaded: (instance) => {
            if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "1") {
              instance.debug();
            }
          },
        });
        posthogClient = ph;
        flushPosthogQueue();
      })
      .catch(() => {
        loadStarted = false;
      });
  });
}

export function initGentrixAnalytics() {
  if (typeof window === "undefined" || !isGentrixAnalyticsEnabled()) return;
  startPosthogLoad();
}

/**
 * Sessiesuper–properties voor PostHog. Wordt aangepast wanneer de bezoeker van context wisselt (bijv. /site → /admin).
 */
export function setGentrixPageContext(updates: Partial<GentrixAnalyticsContext>) {
  current = { ...current, ...updates };
  if (!isGentrixAnalyticsEnabled()) return;
  if (!posthogClient) {
    registerDirty = true;
    return;
  }
  syncRegisterToPosthog();
}

export function trackGentrixEvent(
  name: GentrixEventName,
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!isGentrixAnalyticsEnabled()) return;
  if (!posthogClient) {
    pendingTracks.push({ name, properties });
    startPosthogLoad();
    return;
  }
  const rest: Record<string, string | number | boolean> = {};
  if (properties) {
    for (const [k, v] of Object.entries(properties)) {
      if (v === undefined) continue;
      if (v === null) {
        rest[k] = "";
        continue;
      }
      rest[k] = v;
    }
  }
  try {
    posthogClient.capture(String(name), { ...ctxPayload(), ...rest });
  } catch {
    /* ignore */
  }
}

/**
 * Eénmalig identificeren (bijv. na portaal-login). Alleen wanneer je een stabiele `userId` hebt.
 */
export function identifyGentrixUser(userId: string, traits?: Record<string, string | number | boolean | null>) {
  if (!isGentrixAnalyticsEnabled()) return;
  if (!posthogClient) {
    pendingIdentify = { userId, traits };
    startPosthogLoad();
    return;
  }
  try {
    posthogClient.identify(userId, traits ?? undefined);
  } catch {
    /* ignore */
  }
}

export function captureGentrixPageview(pathWithSearch: string) {
  if (!isGentrixAnalyticsEnabled()) return;
  if (!posthogClient) {
    pendingPageviews.push(pathWithSearch);
    startPosthogLoad();
    return;
  }
  try {
    const href = typeof window !== "undefined" ? window.location.href : pathWithSearch;
    posthogClient.capture("$pageview", { ...ctxPayload(), $current_url: href, path: pathWithSearch });
  } catch {
    /* ignore */
  }
}

export function resetGentrixAnalytics() {
  lastRegisteredJson = "";
  current = { ...defaultContext };
  pendingPageviews.length = 0;
  pendingTracks.length = 0;
  pendingIdentify = null;
  registerDirty = true;
  if (posthogClient) {
    try {
      posthogClient.reset();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Alleen op basis van URL; site-specifieke context komt van child (bijv. `GentrixPublicSiteAnalytics`).
 */
export function inferGentrixContextFromPath(pathname: string, search: string): Partial<GentrixAnalyticsContext> {
  const p = pathname || "/";
  const sp = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const isAdmin = p === "/admin" || p.startsWith("/admin/");
  if (isAdmin) {
    return {
      session_type: "admin",
      is_internal_actor: true,
      actor: "staff",
      site_slug: null,
      page_key: null,
      is_preview: false,
      render_surface: "other",
    };
  }
  if (p === "/portal" || p.startsWith("/portal/")) {
    return {
      session_type: "client_dashboard",
      is_internal_actor: false,
      actor: "known_customer",
      is_preview: false,
      render_surface: "other",
    };
  }
  if (p === "/site" || p.startsWith("/site/")) {
    const hasToken = Boolean(sp.get("token")?.trim());
    return {
      session_type: hasToken ? "public_preview" : "public_site",
      is_preview: hasToken,
      is_internal_actor: false,
      actor: "visitor",
      render_surface: "public_inline",
    };
  }
  return {
    session_type: "other",
    is_internal_actor: false,
    actor: "unknown",
    render_surface: "other",
  };
}

/**
 * Hulp voor scroll in het hoofddocument (inline /site) — 25/50/75/100% eenmalig per “sessie” op de pagina.
 * Ruim throttled via rAF.
 */
export function attachGentrixMainWindowScrollDepth(onDepth: (depth: GentrixScrollDepth) => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }
  const done = new Set<GentrixScrollDepth>();
  const check = () => {
    const el = document.documentElement;
    const b = document.body;
    const sh = Math.max(b?.scrollHeight ?? 0, el.scrollHeight, 1);
    const st = window.scrollY ?? el.scrollTop;
    const vh = window.innerHeight;
    const atBottom = st + vh >= sh - 8;
    const pct = Math.min(100, Math.floor(((st + vh) / sh) * 100));
    const marks: GentrixScrollDepth[] = [25, 50, 75, 100];
    for (const m of marks) {
      if (done.has(m)) continue;
      if (pct >= m || (m === 100 && atBottom)) {
        done.add(m);
        onDepth(m);
      }
    }
  };
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      check();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  queueMicrotask(() => {
    check();
  });
  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };
}

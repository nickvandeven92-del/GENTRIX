import posthog from "posthog-js";
import type {
  GentrixAnalyticsContext,
  GentrixEventName,
  GentrixScrollDepth,
} from "@/lib/analytics/schema";

let inited = false;
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

function envKey() {
  return (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").trim();
}

export function isGentrixAnalyticsEnabled(): boolean {
  return envKey().length > 0;
}

export function initGentrixAnalytics() {
  if (typeof window === "undefined" || inited) return;
  const key = envKey();
  if (!key) return;
  inited = true;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com").trim() || "https://eu.i.posthog.com";
  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage",
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "1") {
        ph.debug();
      }
    },
  });
}

/**
 * Sessiesuper–properties voor PostHog. Wordt aangepast wanneer de bezoeker van context wisselt (bijv. /site → /admin).
 */
export function setGentrixPageContext(updates: Partial<GentrixAnalyticsContext>) {
  const next: MutableContext = { ...current, ...updates };
  current = next;
  if (!isGentrixAnalyticsEnabled() || !inited) return;
  const forRegister: Record<string, string | number | boolean | null> = {
    session_type: next.session_type,
    site_slug: next.site_slug,
    page_key: next.page_key,
    booking_module_enabled: next.booking_module_enabled,
    webshop_module_enabled: next.webshop_module_enabled,
    is_preview: next.is_preview,
    app_environment: next.app_environment,
    is_internal_actor: next.is_internal_actor,
    actor: next.actor,
    render_surface: next.render_surface,
  };
  const asJson = JSON.stringify(forRegister);
  if (asJson === lastRegisteredJson) return;
  lastRegisteredJson = asJson;
  try {
    posthog.register(forRegister);
  } catch {
    /* ignore */
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

export function trackGentrixEvent(
  name: GentrixEventName,
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!isGentrixAnalyticsEnabled() || !inited) return;
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
    posthog.capture(String(name), { ...ctxPayload(), ...rest });
  } catch {
    /* ignore */
  }
}

/**
 * Eénmalig identificeren (bijv. na portaal-login). Alleen wanneer je een stabiele `userId` hebt.
 */
export function identifyGentrixUser(userId: string, traits?: Record<string, string | number | boolean | null>) {
  if (!isGentrixAnalyticsEnabled() || !inited) return;
  try {
    posthog.identify(userId, traits ?? undefined);
  } catch {
    /* ignore */
  }
}

export function captureGentrixPageview(pathWithSearch: string) {
  if (!isGentrixAnalyticsEnabled() || !inited) return;
  try {
    const href = typeof window !== "undefined" ? window.location.href : pathWithSearch;
    posthog.capture("$pageview", { ...ctxPayload(), $current_url: href, path: pathWithSearch });
  } catch {
    /* ignore */
  }
}

export function resetGentrixAnalytics() {
  lastRegisteredJson = "";
  current = { ...defaultContext };
  if (isGentrixAnalyticsEnabled() && inited) {
    try {
      posthog.reset();
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

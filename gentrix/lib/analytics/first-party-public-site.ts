import { attachGentrixMainWindowScrollDepth } from "@/lib/analytics/main-window-scroll-depth";

const VID_KEY = "gentrix_fp_vid";
const SID_KEY = "gentrix_fp_sid";

const BATCH_MS = 5000;
const MAX_QUEUE = 24;

export type FirstPartySiteContext = {
  siteSlug: string;
  pageKey: string;
  isPreview: boolean;
  sessionType: string;
  bookingModuleEnabled: boolean;
  webshopModuleEnabled: boolean;
  renderSurface: string;
};

type OutEvent = {
  event_type: string;
  page_path: string | null;
  page_key: string | null;
  visitor_id: string;
  session_id: string;
  properties: Record<string, string | number | boolean>;
};

let started = false;
let queue: OutEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let ctx: FirstPartySiteContext | null = null;
let visitorId = "";
let sessionId = "";
let engagementT10: ReturnType<typeof setTimeout> | null = null;
let engagementT30: ReturnType<typeof setTimeout> | null = null;
let scrollCleanup: (() => void) | null = null;
let clickBound = false;
let lastRouteKey = "";

function isFirstPartyEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const v = (process.env.NEXT_PUBLIC_GENTRIX_FIRST_PARTY_ANALYTICS ?? "1").trim();
  return v !== "0" && v.toLowerCase() !== "false";
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateVisitorId(): string {
  if (visitorId) return visitorId;
  try {
    const ex = localStorage.getItem(VID_KEY);
    if (ex && ex.trim().length > 0) {
      visitorId = ex.trim().slice(0, 80);
      return visitorId;
    }
    const n = randomId();
    localStorage.setItem(VID_KEY, n);
    visitorId = n;
    return visitorId;
  } catch {
    visitorId = randomId();
    return visitorId;
  }
}

function getOrCreateSessionId(): string {
  if (sessionId) return sessionId;
  try {
    const ex = sessionStorage.getItem(SID_KEY);
    if (ex && ex.trim().length > 0) {
      sessionId = ex.trim().slice(0, 80);
      return sessionId;
    }
    const n = randomId();
    sessionStorage.setItem(SID_KEY, n);
    sessionId = n;
    return sessionId;
  } catch {
    sessionId = randomId();
    return sessionId;
  }
}

function apiUrl(): string {
  if (typeof window === "undefined") return "/api/analytics/events";
  return `${window.location.origin}/api/analytics/events`;
}

function pushEvent(ev: Omit<OutEvent, "visitor_id" | "session_id">) {
  if (!ctx) return;
  const visitor_id = getOrCreateVisitorId();
  const session_id = getOrCreateSessionId();
  queue.push({
    ...ev,
    visitor_id,
    session_id,
    properties: {
      ...ev.properties,
      is_preview: ctx.isPreview,
      session_type: ctx.sessionType,
      booking_module_enabled: ctx.bookingModuleEnabled,
      webshop_module_enabled: ctx.webshopModuleEnabled,
      render_surface: ctx.renderSurface,
    },
  });
  if (queue.length >= MAX_QUEUE) {
    void flushQueue();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushQueue();
    }, BATCH_MS);
  }
}

async function flushQueue() {
  if (queue.length === 0 || !ctx) return;
  const batch = queue;
  queue = [];
  const body = JSON.stringify({ site_slug: ctx.siteSlug, events: batch });
  const url = apiUrl();
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* fail silently */
  }
}

function onBeforeUnload() {
  void flushQueue();
}

function afterLoadAndIdle(run: () => void) {
  if (typeof window === "undefined") return;
  const go = () => {
    const ric = window.requestIdleCallback?.bind(window);
    if (typeof ric === "function") {
      ric(() => run(), { timeout: 4000 });
    } else {
      setTimeout(run, 200);
    }
  };
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}

function readAnalyticsKey(el: Element | null): string | null {
  if (!el) return null;
  const withAttr = el.closest("[data-analytics]") as HTMLElement | null;
  if (!withAttr) return null;
  const v = withAttr.getAttribute("data-analytics");
  return v && v.trim() ? v.trim().slice(0, 200) : null;
}

function onClickCapture(e: MouseEvent) {
  if (!ctx) return;
  const t = e.target;
  if (!(t instanceof Element)) return;
  const el = t.closest("a, button, [role='button']");
  if (!el) return;
  const key = readAnalyticsKey(el);
  if (!key) {
    if (el instanceof HTMLAnchorElement) {
      const h = el.getAttribute("href");
      if (h && h !== "#" && !h.startsWith("javascript:")) {
        /* optional: too noisy — only data-analytics + CTA per spec */
      }
    }
    return;
  }
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const href = el instanceof HTMLAnchorElement ? el.getAttribute("href") : null;
  pushEvent({
    event_type: "click_event",
    page_path: window.location.pathname + window.location.search,
    page_key: ctx.pageKey,
    properties: {
      analytics_key: key,
      link_text: text,
      href: (href ?? "").slice(0, 500),
    },
  });
}

function trackPageView() {
  if (!ctx) return;
  pushEvent({
    event_type: "page_view",
    page_path: window.location.pathname + window.location.search,
    page_key: ctx.pageKey,
    properties: {
      page_key: ctx.pageKey,
    },
  });
}

function startEngagementPings() {
  if (engagementT10) clearTimeout(engagementT10);
  if (engagementT30) clearTimeout(engagementT30);
  engagementT10 = null;
  engagementT30 = null;
  engagementT10 = setTimeout(() => {
    if (!ctx) return;
    pushEvent({
      event_type: "engagement_ping",
      page_path: window.location.pathname + window.location.search,
      page_key: ctx.pageKey,
      properties: { engagement_sec: 10 },
    });
  }, 10_000);
  engagementT30 = setTimeout(() => {
    if (!ctx) return;
    pushEvent({
      event_type: "engagement_ping",
      page_path: window.location.pathname + window.location.search,
      page_key: ctx.pageKey,
      properties: { engagement_sec: 30 },
    });
  }, 30_000);
}

function attachScrollForCurrentPage() {
  if (scrollCleanup) {
    try {
      scrollCleanup();
    } catch {
      /* ignore */
    }
    scrollCleanup = null;
  }
  try {
    scrollCleanup = attachGentrixMainWindowScrollDepth((depth) => {
      if (!ctx) return;
      pushEvent({
        event_type: "scroll_depth",
        page_path: window.location.pathname + window.location.search,
        page_key: ctx.pageKey,
        properties: { depth_pct: depth },
      });
    });
  } catch {
    /* ignore */
  }
}

function applyContextOrRouteChange(nextCtx: FirstPartySiteContext) {
  const path = window.location.pathname + window.location.search;
  const key = `${path}::${nextCtx.pageKey}`;
  ctx = nextCtx;
  if (key === lastRouteKey) return;
  lastRouteKey = key;
  try {
    trackPageView();
    startEngagementPings();
  } catch {
    /* ignore */
  }
  attachScrollForCurrentPage();
}

/**
 * Publiek `/site/…` — start pas na `load` + `requestIdleCallback` (geen FCP/LCP blocking).
 * Eerstepartij: eigen queue + sendBeacon.
 */
export function bootFirstPartyPublicSiteAnalytics(nextCtx: FirstPartySiteContext) {
  if (typeof window === "undefined" || !isFirstPartyEnabled()) return;
  afterLoadAndIdle(() => {
    if (started) {
      applyContextOrRouteChange(nextCtx);
      return;
    }
    started = true;
    getOrCreateVisitorId();
    getOrCreateSessionId();
    applyContextOrRouteChange(nextCtx);

    if (!clickBound) {
      clickBound = true;
      document.addEventListener("click", onClickCapture, true);
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onBeforeUnload);
  });
}

/**
 * Funnel: boeken, offerte, formulierverzending — expliciet vanuit site-JS aanroepen.
 */
export function trackFirstPartyConversion(conversionName: string, extra?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined" || !ctx) return;
  if (!isFirstPartyEnabled() || !started) return;
  const name = conversionName.trim().slice(0, 120);
  if (!name) return;
  pushEvent({
    event_type: "conversion_event",
    page_path: window.location.pathname + window.location.search,
    page_key: ctx.pageKey,
    properties: {
      conversion_name: name,
      ...(extra ?? {}),
    },
  });
  void flushQueue();
}

type GentrixWindow = Window & { __gentrix?: { trackConversion: typeof trackFirstPartyConversion } };
export function installFirstPartyGlobal() {
  if (typeof window === "undefined") return;
  const w = window as GentrixWindow;
  w.__gentrix = { ...w.__gentrix, trackConversion: trackFirstPartyConversion };
}

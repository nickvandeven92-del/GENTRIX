import { attachGentrixMainWindowScrollDepth } from "@/lib/analytics/main-window-scroll-depth";
import { inferAnalyticsElementRoleFromId } from "@/lib/analytics/infer-analytics-element-role";
import type { PublicSiteGeneratorMeta } from "@/lib/analytics/public-site-generator-meta";

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
  /** Optioneel: generator/snapshot-hints op page_view (lichte strings). */
  generatorMeta?: PublicSiteGeneratorMeta;
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

function onClickCapture(e: MouseEvent) {
  if (!ctx) return;
  const t = e.target;
  if (!(t instanceof Element)) return;
  const root = t.closest("[data-analytics]");
  if (!root) return;
  const key = (root.getAttribute("data-analytics") ?? "").trim().slice(0, 200);
  if (!key) return;

  const fromSectionAttr = (root.getAttribute("data-analytics-section") ?? "").trim().slice(0, 64);
  const idxRaw = root.getAttribute("data-analytics-index");
  const index =
    idxRaw != null && /^\d+$/.test(idxRaw.trim()) ? Number.parseInt(idxRaw.trim(), 10) : undefined;

  const clickable = t.closest("a, button, [role='button']");
  const host =
    root.matches("a, button, [role='button']")
      ? root
      : clickable && root.contains(clickable)
        ? clickable
        : null;

  const text = (host ?? root).textContent?.replace(/\s+/g, " ").trim().slice(0, 200) ?? "";
  const href =
    host instanceof HTMLAnchorElement
      ? host.getAttribute("href")
      : host instanceof Element && host.closest("a")
        ? (host.closest("a") as HTMLAnchorElement).getAttribute("href")
        : null;

  let sectionId = fromSectionAttr;
  if (!sectionId) {
    const sec = root.closest("section[id]");
    if (sec?.id) sectionId = sec.id.trim().slice(0, 64);
  }

  const path = window.location.pathname + window.location.search;
  const elementRole = inferAnalyticsElementRoleFromId(key);

  const props: Record<string, string | number | boolean> = {
    analytics_id: key,
    analytics_key: key,
    label: text,
    link_text: text,
    href: (href ?? "").slice(0, 500),
    page_path: path,
    page_key: ctx.pageKey,
    element_role: elementRole,
  };
  if (sectionId) props.section_id = sectionId;
  if (index !== undefined) props.index = index;

  pushEvent({
    event_type: "click_event",
    page_path: path,
    page_key: ctx.pageKey,
    properties: props,
  });
}

function trackPageView() {
  if (!ctx) return;
  const gm = ctx.generatorMeta;
  const genProps: Record<string, string | number | boolean> = {};
  if (gm) {
    for (const [k, v] of Object.entries(gm)) {
      if (typeof v === "string" && v.length > 0) genProps[k] = v.slice(0, 500);
    }
  }
  pushEvent({
    event_type: "page_view",
    page_path: window.location.pathname + window.location.search,
    page_key: ctx.pageKey,
    properties: {
      page_key: ctx.pageKey,
      ...genProps,
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

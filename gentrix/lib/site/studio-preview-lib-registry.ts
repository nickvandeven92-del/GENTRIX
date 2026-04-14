/**
 * Eerste-partij proxy voor studio iframe `srcDoc` — omzeilt o.a. Edge “Tracking Prevention”
 * op scripts van jsDelivr/unpkg in sandboxed iframes (Alpine/Lucide start dan niet → menu blijft open).
 *
 * Upstream-URL’s: synchroon houden met `tailwind-page-html.ts` / `studio-*-cdn.ts`.
 */
import { STUDIO_ALPINE_CDN_SRC } from "@/lib/site/studio-alpine-cdn";
import { STUDIO_LUCIDE_UMD_SRC } from "@/lib/site/studio-lucide-cdn";
import { STUDIO_TAILWIND_PLAY_CDN_SRC } from "@/lib/site/studio-tailwind-cdn";

const STUDIO_AOS_CSS_CDN_SRC = "https://unpkg.com/aos@2.3.4/dist/aos.css";
const STUDIO_AOS_JS_CDN_SRC = "https://unpkg.com/aos@2.3.4/dist/aos.js";

const STUDIO_GSAP_VERSION = "3.12.5";
const STUDIO_GSAP_BASE = `https://cdn.jsdelivr.net/npm/gsap@${STUDIO_GSAP_VERSION}/dist`;
const STUDIO_GSAP_CORE_CDN_SRC = `${STUDIO_GSAP_BASE}/gsap.min.js`;
const STUDIO_GSAP_SCROLLTRIGGER_CDN_SRC = `${STUDIO_GSAP_BASE}/ScrollTrigger.min.js`;
const STUDIO_GSAP_FLIP_CDN_SRC = `${STUDIO_GSAP_BASE}/Flip.min.js`;
const STUDIO_GSAP_MOTIONPATH_CDN_SRC = `${STUDIO_GSAP_BASE}/MotionPathPlugin.min.js`;
const STUDIO_GSAP_OBSERVER_CDN_SRC = `${STUDIO_GSAP_BASE}/Observer.min.js`;

/** Query `name=` → upstream absolute URL (alleen deze keys zijn toegestaan). */
export const STUDIO_PREVIEW_LIB_UPSTREAM: Record<string, string> = {
  alpine: STUDIO_ALPINE_CDN_SRC,
  lucide: STUDIO_LUCIDE_UMD_SRC,
  "tailwind-play": STUDIO_TAILWIND_PLAY_CDN_SRC,
  "aos-css": STUDIO_AOS_CSS_CDN_SRC,
  "aos-js": STUDIO_AOS_JS_CDN_SRC,
  "gsap-core": STUDIO_GSAP_CORE_CDN_SRC,
  "gsap-scrolltrigger": STUDIO_GSAP_SCROLLTRIGGER_CDN_SRC,
  "gsap-flip": STUDIO_GSAP_FLIP_CDN_SRC,
  "gsap-motionpath": STUDIO_GSAP_MOTIONPATH_CDN_SRC,
  "gsap-observer": STUDIO_GSAP_OBSERVER_CDN_SRC,
};

export function isStudioPreviewLibName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(STUDIO_PREVIEW_LIB_UPSTREAM, name);
}

/** Vervangt bekende CDN-URL’s in volledige srcDoc-HTML door `/api/public/studio-preview-lib?…` op `origin`. */
export function rewriteStudioPreviewExternalScripts(html: string, origin: string): string {
  const o = origin.trim().replace(/\/$/, "");
  if (!o) return html;
  const entries = Object.entries(STUDIO_PREVIEW_LIB_UPSTREAM) as [string, string][];
  entries.sort((a, b) => b[1].length - a[1].length);
  let out = html;
  for (const [name, url] of entries) {
    if (!url || !out.includes(url)) continue;
    const proxy = `${o}/api/public/studio-preview-lib?name=${encodeURIComponent(name)}`;
    out = out.split(url).join(proxy);
  }
  return out;
}

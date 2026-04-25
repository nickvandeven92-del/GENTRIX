import { sliceFirstSiteChromeNavBlock } from "@/lib/ai/generate-site-postprocess";
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { StudioNavChromeConfig, StudioNavLink } from "@/lib/site/studio-nav-chrome-schema";
import { studioNavChromeConfigSchema } from "@/lib/site/studio-nav-chrome-schema";
import { sliceOpenTagContent } from "@/lib/site/html-open-tag";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function looksLikeBrandHomeHref(href: string): boolean {
  const h = href.trim();
  if (!h) return false;
  if (h === "#top" || h === "#" || h === "/") return true;
  if (/^#__STUDIO_SITE_BASE__$/.test(h)) return true;
  if (!h.startsWith("__STUDIO_SITE_BASE__")) return false;
  const tail = h.slice("__STUDIO_SITE_BASE__".length);
  return tail === "" || tail === "/" || tail.startsWith("?") || tail.startsWith("#");
}

const CTA_INTENT_RE =
  /^(contact|boek|afspraak|maak\s+een\s+afspraak|maak\s+afspraak|reserveer|plan\s+een\s+afspraak)/i;

function looksLikeCta(href: string, label: string): boolean {
  if (CTA_INTENT_RE.test(label.trim())) return true;
  return /#contact\b|__STUDIO_CONTACT_PATH__|__STUDIO_BOOKING_PATH__|\/contact(?:\?|#|$)|\/boek\//i.test(href);
}

/**
 * Vindt `<a>`-tags quote-aware (geen naïeve `[^>]*` op de open-tag).
 */
function forEachAnchorInHtml(html: string, fn: (href: string, label: string) => void): void {
  let pos = 0;
  while (pos < html.length) {
    const rel = html.slice(pos);
    const i = rel.search(/<a\b/i);
    if (i === -1) break;
    const abs = pos + i;
    const s = sliceOpenTagContent(html, abs);
    if (!s || s.tagName.toLowerCase() !== "a") {
      pos = abs + 2;
      continue;
    }
    const closeIdx = html.toLowerCase().indexOf("</a>", s.end);
    if (closeIdx === -1) break;
    const inner = html.slice(s.end, closeIdx);
    const hrefM = /\bhref\s*=\s*["']([^"']*)["']/i.exec(s.attrs);
    const href = hrefM?.[1]?.trim() ?? "";
    const aria = /\baria-label\s*=\s*["']([^"']*)["']/i.exec(s.attrs)?.[1]?.trim() ?? "";
    const label = (aria || stripTags(inner)).slice(0, 80).trim();
    fn(href, label);
    pos = closeIdx + 4;
  }
}

function firstChromeBlockFromSections(sections: readonly TailwindSection[]): string | null {
  for (const s of sections) {
    const w = sliceFirstSiteChromeNavBlock(s.html);
    if (w) return w.block;
  }
  return null;
}

function pickVariantFromChrome(html: string): "bar" | "pill" {
  return /\brounded-full\b/i.test(html) ? "pill" : "bar";
}

/**
 * Leest labels/hrefs uit de bestaande AI-chrome (geen DB-wijziging).
 * Faalt stil (`null`) als er te weinig betrouwbare links zijn — dan blijft de oude HTML staan.
 */
export function inferStudioNavChromeFromSections(sections: readonly TailwindSection[]): StudioNavChromeConfig | null {
  const chrome = firstChromeBlockFromSections(sections);
  if (!chrome) return null;

  const ordered: StudioNavLink[] = [];
  const seenHref = new Set<string>();

  forEachAnchorInHtml(chrome, (href, label) => {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.toLowerCase().startsWith("javascript:"))
      return;
    if (!label) return;
    const key = href.toLowerCase();
    if (seenHref.has(key)) return;
    seenHref.add(key);
    ordered.push({ label, href });
  });

  if (ordered.length < 2) return null;

  let brand = ordered[0]!;
  let rest = ordered.slice(1);
  const firstLooksHome = looksLikeBrandHomeHref(brand.href);
  if (!firstLooksHome && ordered.some((x) => looksLikeBrandHomeHref(x.href))) {
    const idx = ordered.findIndex((x) => looksLikeBrandHomeHref(x.href));
    brand = ordered[idx]!;
    rest = [...ordered.slice(0, idx), ...ordered.slice(idx + 1)];
  }

  const ctaIdx = rest.findIndex((x) => looksLikeCta(x.href, x.label));
  let cta: StudioNavLink | undefined;
  let navItems = rest;
  if (ctaIdx !== -1) {
    cta = rest[ctaIdx]!;
    navItems = rest.filter((_, i) => i !== ctaIdx);
  }

  if (navItems.length === 0) return null;

  const variant = pickVariantFromChrome(chrome);
  const raw: StudioNavChromeConfig = {
    variant,
    navVisualPreset: variant === "pill" ? "floatingPill" : "minimalLight",
    brandLabel: brand.label.slice(0, 120),
    brandHref: brand.href,
    items: navItems.slice(0, 16),
    ...(cta ? { cta } : {}),
  };

  const parsed = studioNavChromeConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

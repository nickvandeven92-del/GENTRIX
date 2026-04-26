import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { StudioRasterBrandSet } from "@/lib/ai/tailwind-sections-schema";
import { findHtmlOpenTagEnd } from "@/lib/site/html-open-tag";
import { STUDIO_BRAND_MARK_ATTR } from "@/lib/site/brand-logo-inject";

const RASTER_BRAND_ATTR = "data-gentrix-raster-brand";

/** `headerLogoUrl` mag nooit het 32×32/192×192 favicon zijn — dat geeft een onleesbare “postzegel” in de navbar. */
export function rasterHeaderUrlIsConfusableWithFavicon(headerUrl: string, raster: StudioRasterBrandSet): boolean {
  const h = headerUrl.trim().toLowerCase();
  if (!h) return false;
  const f32 = raster.favicon32Url?.trim().toLowerCase() ?? "";
  const f192 = raster.favicon192Url?.trim().toLowerCase() ?? "";
  if (f32 && h === f32) return true;
  if (f192 && h === f192) return true;
  if (/\/favicon[^/]*\.(png|webp|ico)(\?|$)/i.test(headerUrl)) return true;
  if (/favicon[-_]?(32|192)\b/i.test(headerUrl)) return true;
  return false;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function injectAfterFirstTag(html: string, tagName: string, block: string): string | null {
  const re = new RegExp(`<${tagName}\\b`, "i");
  const m = re.exec(html);
  if (m == null || m.index === undefined) return null;
  const openEnd = findHtmlOpenTagEnd(html, m.index);
  if (openEnd <= m.index) return null;
  return html.slice(0, openEnd) + block + html.slice(openEnd);
}

/**
 * Vervangt de inhoud van de eerste `<a href="__STUDIO_SITE_BASE__">…</a>` door een `<img>`-logo
 * (ondiepe nesting: geen geneste `<a>` in de innerHTML).
 */
function replaceFirstHomeAnchorWithImg(
  html: string,
  imgInner: string,
  ariaLabel: string,
): { next: string; ok: true } | { ok: false } {
  const needle = 'href="__STUDIO_SITE_BASE__"';
  const hrefIdx = html.indexOf(needle);
  if (hrefIdx < 0) return { ok: false };
  const aStart = html.lastIndexOf("<a", hrefIdx);
  if (aStart < 0) return { ok: false };
  const gt = html.indexOf(">", aStart);
  if (gt < 0 || gt > hrefIdx) return { ok: false };
  const innerStart = gt + 1;
  const lower = html.toLowerCase();
  let depth = 0;
  let pos = innerStart;
  while (pos < html.length) {
    const o = lower.indexOf("<a", pos);
    const c = lower.indexOf("</a>", pos);
    if (c < 0) return { ok: false };
    if (o >= 0 && o < c) {
      depth++;
      pos = o + 2;
      continue;
    }
    if (depth === 0) {
      let openTag = html.slice(aStart, gt + 1);
      if (!new RegExp(`\\b${STUDIO_BRAND_MARK_ATTR}\\s*=`, "i").test(openTag)) {
        openTag = openTag.replace(/<a\b/i, `<a ${STUDIO_BRAND_MARK_ATTR}="1"`);
      }
      if (!/\baria-label\s*=/i.test(openTag)) {
        openTag = openTag.replace(/>$/, ` aria-label="${escapeHtmlAttr(ariaLabel)}">`);
      }
      const next = html.slice(0, aStart) + openTag + imgInner + html.slice(c);
      return { next, ok: true };
    }
    depth--;
    pos = c + 4;
  }
  return { ok: false };
}

export function applyRasterBrandMarkToSections(
  sections: TailwindSection[],
  raster: StudioRasterBrandSet,
  businessName: string,
): TailwindSection[] {
  const url = raster.headerLogoUrl.trim();
  if (!url) return sections;
  if (rasterHeaderUrlIsConfusableWithFavicon(url, raster)) return sections;

  const full = sections.map((s) => s.html).join("\n");
  /**
   * `config.studioNav` → `prependStudioNavChromeToFirstSection` zet al merk (monogram + label).
   * Raster vervangt anders de **eerste** `href="__STUDIO_SITE_BASE__"` elders (bv. in de hero) wanneer
   * `brandHref` geen placeholder is — dat levert een tweede postzegel-logo naast de balk.
   */
  if (/\bdata-studio-nav-chrome\s*=\s*["']1["']/i.test(full)) return sections;
  if (full.includes(RASTER_BRAND_ATTR) && full.includes(url)) {
    return sections;
  }

  const label = businessName.trim().slice(0, 120) || "Home";
  const brandEsc = escapeHtmlAttr(label);
  const imgInner = `<img src="${escapeHtmlAttr(url)}" alt="${brandEsc}" width="220" height="48" class="h-8 w-auto max-h-9 max-w-[min(100%,280px)] object-contain object-left" loading="eager" decoding="async" ${RASTER_BRAND_ATTR}="1"/>`;

  const copy = sections.map((s) => ({ ...s, html: s.html }));
  for (let i = 0; i < copy.length; i++) {
    const rep = replaceFirstHomeAnchorWithImg(copy[i]!.html, imgInner, label);
    if (rep.ok) {
      copy[i] = { ...copy[i]!, html: rep.next };
      return copy;
    }
  }

  const block = `\n<div class="flex shrink-0 items-center" ${RASTER_BRAND_ATTR}="1"><a href="__STUDIO_SITE_BASE__" class="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 rounded-sm" ${STUDIO_BRAND_MARK_ATTR}="1" aria-label="${brandEsc}">${imgInner}</a></div>\n`;

  for (const tag of ["header", "nav", "section"] as const) {
    for (let i = 0; i < copy.length; i++) {
      const next = injectAfterFirstTag(copy[i]!.html, tag, block);
      if (next != null) {
        copy[i] = { ...copy[i]!, html: next };
        return copy;
      }
    }
  }

  const pNorm = collapseWs(imgInner);
  if (pNorm.length >= 16 && collapseWs(full).includes(pNorm)) return sections;

  return sections;
}

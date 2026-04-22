import { STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";

/**
 * Deterministische variant (0–2) o.b.v. slug/merk — voorkomt dat elke preview dezelfde hoek/plaatsing heeft.
 */
export function pickStudioSiteCreditVariant(seed: string | null | undefined): "0" | "1" | "2" {
  const s = (seed ?? "").trim().toLowerCase() || "studio";
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const v = Math.abs(h) % 3;
  return v === 0 ? "0" : v === 1 ? "1" : "2";
}

/**
 * Inline SSR (`PublicPublishedTailwindInline`) splitt alleen `<head>`/`<body>` uit het volledige srcDoc-document.
 * Zonder deze attributen op het echte `<html>` matchen veel shell-regels niet (`html[data-gentrix-studio-iframe="1"]`
 * in o.a. STUDIO_IFRAME_PREVIEW_HEADER_Z_CSS, STUDIO_FIXED_NAV_HERO_INSET_CSS) → navbar/hero wijken af van de CRM-preview.
 */
export function publishedTailwindInlineHtmlShellAttrs(opts: {
  publishedSlug?: string | null;
  navBrandLabel?: string | null;
}): Record<string, string> {
  const slug = opts.publishedSlug?.trim();
  const isHome = (slug?.toLowerCase() ?? "") === STUDIO_HOMEPAGE_SUBFOLDER_SLUG;
  const variant = pickStudioSiteCreditVariant(slug || opts.navBrandLabel?.trim() || "");
  const out: Record<string, string> = {
    "data-gentrix-studio-iframe": "1",
    "data-gentrix-site-credit-variant": variant,
  };
  if (isHome) out["data-gentrix-scroll-nav-fallback"] = "1";
  return out;
}

import { isLegacyTailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import type { PublishedSitePayload } from "@/lib/site/project-published-payload";

export type PublicSiteShellColors = { bg: string; fg: string };

/** Verwijdert `<` zodat themawaarden de `</style>`-context niet kunnen breken. */
function safeCssColorToken(raw: string, fallback: string): string {
  const t = raw.replace(/[<]/g, "").trim();
  return t.length > 0 ? t : fallback;
}

/**
 * Zelfde bron als `app/(public)/site/[slug]/page.tsx` (landingsroute): achtergrond/tekst voor
 * `html,body` i.p.v. alleen het layout-default **wit** tussen App Router-soft navigaties.
 */
export function computePublicSiteShellColors(payload: PublishedSitePayload): PublicSiteShellColors {
  if (payload.kind === "tailwind") {
    const cfg = payload.config != null && !isLegacyTailwindPageConfig(payload.config) ? payload.config : undefined;
    /**
     * Shell moet de pagina-achtergrond volgen (niet de merk-primary). Primary is vaak donker en gaf op desktop
     * een zwarte balk onder een fixed nav-spacer als `theme.background` ontbrak.
     */
    const bgRaw = cfg?.theme?.background?.trim() || "#ffffff";
    const fgRaw = cfg?.theme?.textColor?.trim() || "#171717";
    return {
      bg: safeCssColorToken(bgRaw, "#ffffff"),
      fg: safeCssColorToken(fgRaw, "#171717"),
    };
  }
  if (payload.kind === "react") {
    const bgRaw = payload.doc?.theme?.background?.trim() || "#ffffff";
    const fgRaw = payload.doc?.theme?.foreground?.trim() || "#171717";
    return {
      bg: safeCssColorToken(bgRaw, "#ffffff"),
      fg: safeCssColorToken(fgRaw, "#171717"),
    };
  }
  const site = payload.site as { theme?: { background?: string; foreground?: string } };
  const bgRaw = site?.theme?.background?.trim() || "#ffffff";
  const fgRaw = site?.theme?.foreground?.trim() || "#171717";
  return {
    bg: safeCssColorToken(bgRaw, "#ffffff"),
    fg: safeCssColorToken(fgRaw, "#171717"),
  };
}

/** Inline CSS voor `<style>` — overschrijft `site/[slug]/layout.tsx` body-wit tijdens route-wissels. */
export function publicSiteShellGlobalCssBlock(shell: PublicSiteShellColors): string {
  return `:root{
          --public-site-shell-bg:${shell.bg};
          --public-site-shell-fg:${shell.fg};
        }
        html,body{
          background:${shell.bg}!important;
          color:${shell.fg}!important;
        }`;
}

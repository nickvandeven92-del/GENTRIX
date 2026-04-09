import type { SiteConfig } from "@/lib/ai/build-site-config";
import { getCompactnessPreset } from "@/lib/ai/page-compactness-presets";
import type { CompactnessProfile, PageLengthTarget } from "@/types/pageCompactness";

const scoreMatch = (text: string, patterns: RegExp[]): number =>
  patterns.reduce((acc, pattern) => acc + (pattern.test(text) ? 1 : 0), 0);

const inferPageLengthTarget = (config: SiteConfig): PageLengthTarget => {
  const goal = (config.primary_goal ?? "").toLowerCase();
  const audience = (config.target_audience ?? "").toLowerCase();
  const style = (config.brand_style ?? "").toLowerCase();
  const density = (config.layout_density ?? "").toLowerCase();
  const visualStyle = (config.visual_style ?? "").toLowerCase();

  /** Zonder `layout_density`: woorden als "spacious" of lead-gerelateerde doelen mogen niet dubbel als extended/compact tellen. */
  const textForSignals = `${goal} ${audience} ${style} ${visualStyle}`;

  const compactSignals = scoreMatch(textForSignals, [
    /lead/,
    /offerte/,
    /aanvraag/,
    /contact/,
    /afspraak/,
    /intake/,
    /call/,
    /quote/,
    /boek/,
    /mkb/,
    /zzp/,
    /lokaa?l/,
    /bouw/,
    /installatie/,
    /metaal/,
    /staal/,
    /schilder/,
    /dak/,
    /klus/,
    /dienst/,
    /service/,
    /compact/,
    /direct/,
    /snel/,
  ]);

  const extendedSignals = scoreMatch(textForSignals, [
    /editorial/,
    /luxury/,
    /luxe/,
    /brand/,
    /story/,
    /verhaal/,
    /premium/,
    /studio/,
    /architect/,
    /interieur/,
    /mode/,
    /campaign/,
    /immersive/,
    /cinematic/,
    /showcase/,
    /portfolio/,
  ]);

  if (density === "compact") return "compact";

  if (
    (style.includes("editorial") ||
      style.includes("luxury") ||
      visualStyle.includes("cinematic") ||
      visualStyle.includes("immersive")) &&
    density === "spacious"
  ) {
    return "extended";
  }

  if (compactSignals >= extendedSignals + 2) return "compact";
  if (extendedSignals >= compactSignals + 2) return "extended";
  return "balanced";
};

export function resolvePageCompactness(config: SiteConfig): CompactnessProfile {
  const target = config.page_length_target ?? inferPageLengthTarget(config);
  return getCompactnessPreset(target);
}

export {
  applyHomepageCompactnessToSiteConfig,
  buildHomepageCompactnessPlan,
  type HomepageCompactnessPlan,
} from "@/lib/ai/homepage-compactness-plan";

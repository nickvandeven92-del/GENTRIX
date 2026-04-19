import type { DesignGenerationContract, ReferenceVisualAxes } from "@/lib/ai/design-generation-contract";
import { SITE_SIGNATURE_ARCHETYPE_LABELS } from "@/lib/ai/site-signature-schema";

const PALETTE_MODE_NL: Record<DesignGenerationContract["paletteMode"], string> = {
  light: "licht hoofdthema",
  dark: "donker hoofdthema",
  either: "licht of donker (één duidelijke hoofdrichting)",
};

const MOTION_LEVEL_NL: Record<DesignGenerationContract["motionLevel"], string> = {
  none: "zo goed als geen decoratieve beweging",
  subtle: "subtiele motion",
  moderate: "merkbare maar ingetogen animatie",
  strong: "uitgesproken motion",
};

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function layoutRhythmNl(v: ReferenceVisualAxes["layoutRhythm"]): string {
  const m: Record<ReferenceVisualAxes["layoutRhythm"], string> = {
    tight: "strak kolomritme",
    balanced: "evenwichtig witruimte-ritme",
    airy: "luchtig, veel adem",
    editorial_mosaic: "editoriaal mozaïek-layout",
    unspecified: "niet nader gespecificeerd uit referentie",
  };
  return m[v];
}

function themeModeNl(v: ReferenceVisualAxes["themeMode"]): string {
  const m: Record<ReferenceVisualAxes["themeMode"], string> = {
    light: "overwegend licht",
    dark: "overwegend donker",
    mixed: "licht en donker gemixt",
    unspecified: "thema niet afgeleid uit referentie",
  };
  return m[v];
}

function typographyNl(v: ReferenceVisualAxes["typographyDirection"]): string {
  const m: Record<ReferenceVisualAxes["typographyDirection"], string> = {
    sans_modern: "moderne sans-serif",
    sans_humanist: "humanistische sans",
    serif_editorial: "serif met editoriale uitstraling",
    mixed_pairing: "gemixt lettertype-paar",
    mono_accent: "monospace als accent",
    unspecified: "typografie niet afgeleid uit referentie",
  };
  return m[v];
}

function motionStyleNl(v: ReferenceVisualAxes["motionStyle"]): string {
  const m: Record<ReferenceVisualAxes["motionStyle"], string> = {
    static_minimal: "statisch of minimaal",
    scroll_reveal: "onthullen bij scroll",
    expressive: "expressieve beweging",
    unspecified: "motion niet afgeleid uit referentie",
  };
  return m[v];
}

/**
 * Leesbare NL-samenvatting van het bindende designcontract — bedoeld als menselijk checkpoint na Denklijn
 * (niet als vervanging van technische contractvelden in admin).
 */
export function formatDesignContractHumanSummaryNl(
  contract: DesignGenerationContract,
  options?: { maxChars?: number },
): string {
  const parts: string[] = [];

  const sig = contract.siteSignature;
  if (sig) {
    const label = SITE_SIGNATURE_ARCHETYPE_LABELS[sig.archetype];
    parts.push(
      `Compositielijn: ${label} ${clip(sig.commitment_nl, 220)}`.trim(),
    );
    if (sig.anti_templates_nl.length > 0) {
      const anti = sig.anti_templates_nl.slice(0, 3).join(" · ");
      parts.push(`Vermijden we expliciet: ${clip(anti, 280)}`);
    }
  }

  parts.push(
    `Palett (${PALETTE_MODE_NL[contract.paletteMode]}), beweging: ${MOTION_LEVEL_NL[contract.motionLevel]}.`,
  );

  const heroLine = clip(contract.heroVisualSubject, 160);
  parts.push(`Hero-focus: ${heroLine}`);

  const axes = contract.referenceVisualAxes;
  if (axes) {
    const refBits = [
      `Referentie vertaald naar: ${layoutRhythmNl(axes.layoutRhythm)}, ${themeModeNl(axes.themeMode)}, ${typographyNl(axes.typographyDirection)}, motion ${motionStyleNl(axes.motionStyle)}.`,
      `Kleurintentie: ${clip(axes.paletteIntent, 200)}`,
      `Hero-opbouw: ${clip(axes.heroComposition, 180)}`,
    ];
    parts.push(refBits.join(" "));
  }

  if (contract.toneSummary?.trim()) {
    parts.push(`Toon copy: ${clip(contract.toneSummary.trim(), 160)}`);
  }

  let out = parts.filter((p) => p.length > 0).join(" ");

  const maxChars = options?.maxChars;
  if (maxChars != null && out.length > maxChars) {
    const slice = out.slice(0, maxChars);
    const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(" · "));
    const cut = lastStop > maxChars * 0.5 ? slice.slice(0, lastStop + 1).trimEnd() : slice.trimEnd();
    out = cut.endsWith("…") ? cut : `${cut}…`;
  }

  return out;
}

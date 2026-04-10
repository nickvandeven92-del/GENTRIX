/**
 * Richting voor levendige, karaktervolle output — aangevuld op §2 (kleuren) in de user-prompt.
 * Geen aparte prompt-generator: één blok in `buildWebsiteGenerationUserPrompt`.
 */

/** Referentie-paletten (barbier/salon); model mag mengen met briefing. */
export const BARBER_LOVABLE_PRESETS = {
  /** Licht editorial / high-end — even geldig als donker voor “luxe” barbier. */
  luxury_light: {
    primary: "#1c1917",
    secondary: "#57534e",
    accent: "#b45309",
    background: "#faf8f5",
    textColor: "#1c1917",
    note: "Ivoor-stone basis, messing of navy als accent; geen near-black als default.",
  },
  luxury_dark: {
    primary: "#1a1a1a",
    secondary: "#c9a03d",
    accent: "#d4af37",
    background: "#0a0a0a",
    textColor: "#fafafa",
    note: "Goud/brons op donker, subtiele borders in brass-tint.",
  },
  vintage_warm: {
    primary: "#2c1810",
    secondary: "#8b4513",
    accent: "#cd853f",
    background: "#f5e6d3",
    textColor: "#2c1810",
    note: "Warm papier, donkerbruine typografie, terracotta accent.",
  },
  modern_fresh: {
    primary: "#1e3a8a",
    secondary: "#3b82f6",
    accent: "#f59e0b",
    background: "#ffffff",
    textColor: "#1f2937",
    note: "Navy + helder blauw + amber CTA.",
  },
  edgy_contrast: {
    primary: "#991b1b",
    secondary: "#dc2626",
    accent: "#f97316",
    background: "#111827",
    textColor: "#f9fafb",
    note: "Hoog contrast; weinig schaduw, strakke randen.",
  },
} as const;

const BARBER_KEYWORDS =
  /\b(barbier|barbershop|barber|kapper|kapsalon|salon|knip|knipbeurt|baard|fade|scheer)/i;

/** Briefing vraagt vintage / warm papier / old-school (ook zonder het woord “barbier”). */
const VINTAGE_WARM_PAPER_KEYWORDS =
  /\b(vintage|retro|warm\w*\s+papier|papierlook|papierachtig|klassiek\w*|old[\s-]?school|oldschool|nostalg\w*|heritage|erfgoed|traditioneel\w*|authentiek\w*|ambacht\w*|old[\s-]?school\w*\s+typo|typografie\w*\s+jaren\s*['’]?\s*\d{2}|schreefletters?|serif\s+kop)/i;

export function detectBarberLikeContext(text: string): boolean {
  return BARBER_KEYWORDS.test(text);
}

export function detectVintageWarmPaperContext(text: string): boolean {
  return VINTAGE_WARM_PAPER_KEYWORDS.test(text);
}

export function buildLovableThemeDirectiveBlock(params: {
  preserveLayoutUpgrade: boolean;
  businessName: string;
  description: string;
  /** Kort themablok i.p.v. barbier/vintage-uitweidingen. */
  minimal?: boolean;
}): string {
  if (params.preserveLayoutUpgrade) {
    return `=== 2A. THEMA-RIJKDOM (upgrade-modus) ===
- Behoud bestaande \`config.theme\` en zichtbare kleuren in de HTML tenzij de briefing **expliciet** nieuwe stijl vraagt.
- Optionele nieuwe theme-velden alleen toevoegen als de gebruiker dat inhoudelijk vraagt.
`;
  }

  if (params.minimal) {
    return `=== 2A. THEMA (compact) ===
- Vul \`config.theme\` passend bij de briefing; gebruik optionele velden (\`background\`, \`textColor\`, \`vibe\`, \`typographyStyle\`, …) alleen als ze de HTML duidelijk verbeteren.
- Minstens één duidelijke accentkleur als de branche dat vraagt; volg verder **\_design_preset**.
`;
  }

  const ctx = `${params.businessName}\n${params.description}`;
  const barber = detectBarberLikeContext(ctx);
  const vintageWarm = detectVintageWarmPaperContext(ctx);

  const lines: string[] = [
    "=== 2A. THEMA-RIJKDOM & KARAKTER (anti-grijs-template) ===",
    "",
    "- **Verboden:** een volledige marketingpagina die **alleen** grijstinten + zwart/wit gebruikt terwijl de branche warmte, luxe of kleur uitstraalt. Er moet **minstens één** duidelijke accentkleur in buttons, prijs-highlights, badges, borders of hero zichtbaar zijn.",
    "- Vul \`config.theme\` aan met **optionele** velden waar ze helpen: \`secondary\`, \`background\`, \`textColor\`, \`textMuted\`, \`secondaryLight\` / \`secondaryMain\` / \`secondaryDark\`, plus \`vibe\`, \`typographyStyle\`, \`borderRadius\`, \`shadowScale\`, \`spacingScale\` — en **vertaal** die naar Tailwind (\`bg-*\`, \`text-*\`, \`border-*\`, \`shadow-*\`, \`rounded-*\`, \`gap-*\`, \`py-*\`).",
    "- **vibe** alleen: luxury, rustic, modern, minimal, playful, corporate, creative, warm, **industrial** (metaal/werkplaats), **artisan** (handwerk/makers). **typographyStyle** alleen: modern, elegant, bold, minimal, playful, industrial, artisan — geen vrije strings zoals \`rugged\` (gebruik industrial/rustic).",
    "- **Tokens → utilities:** \`shadowScale\` \`lg\` ⇒ \`shadow-lg\` op **focale** vlakken (CTA, uitgelichte tier, zwevende nav) — **niet** automatisch op elke tekstkolom; \`borderRadius\` \`xl\` ⇒ \`rounded-xl\` waar het past; \`spacingScale\` \`generous\` ⇒ ruimere **sectie**-padding en grotere gaps; \`typographyStyle\` \`elegant\` ⇒ serif-koppen of strakke display-tracking; \`playful\` ⇒ contrasterende accentvlakken zonder alles te kaderen.",
    "- **Pricing:** minstens één tier visueel **uitgelicht** (accent, schaduw of zacht vlak) — de andere tiers mogen rustiger/open; geen drie identieke witte dozen als enige optie.",
    "- **Micro-sfeer:** \`hover:scale-105\`, \`transition\`, \`duration-300\` op primaire knoppen/uitgelichte vlakken zijn toegestaan binnen de standaard Tailwind-schaal.",
  ];

  if (barber) {
    lines.push(
      "",
      "**Branche-hint (barbier / salon / knip):** kies bewust **goud, warm hout, diep navy, crème of terracotta** — niet generiek SaaS-grijs. **Luxe is geen synoniem voor donker**; referentie (één hoofdrichting of mix met briefing):",
      `- Luxe licht — primary \`${BARBER_LOVABLE_PRESETS.luxury_light.primary}\`, secondary \`${BARBER_LOVABLE_PRESETS.luxury_light.secondary}\`, accent \`${BARBER_LOVABLE_PRESETS.luxury_light.accent}\`, background \`${BARBER_LOVABLE_PRESETS.luxury_light.background}\`.`,
      `- Luxe donker — primary \`${BARBER_LOVABLE_PRESETS.luxury_dark.primary}\`, secondary \`${BARBER_LOVABLE_PRESETS.luxury_dark.secondary}\`, accent \`${BARBER_LOVABLE_PRESETS.luxury_dark.accent}\`, background \`${BARBER_LOVABLE_PRESETS.luxury_dark.background}\`.`,
      `- Vintage warm — background \`${BARBER_LOVABLE_PRESETS.vintage_warm.background}\`, tekst \`${BARBER_LOVABLE_PRESETS.vintage_warm.textColor}\`, accent \`${BARBER_LOVABLE_PRESETS.vintage_warm.accent}\`.`,
      `- Modern fris — primary \`${BARBER_LOVABLE_PRESETS.modern_fresh.primary}\`, accent CTA \`${BARBER_LOVABLE_PRESETS.modern_fresh.accent}\`.`,
    );
  }

  if (vintageWarm) {
    const v = BARBER_LOVABLE_PRESETS.vintage_warm;
    lines.push(
      "",
      "**Vintage / warm papier / old-school (briefing — strikt doorvoeren):**",
      `- Zet \`config.theme.background\` / \`textColor\` / \`accent\` in lijn met warm papier: bv. background \`${v.background}\`, text \`${v.textColor}\`, accent \`${v.accent}\` (mag iets bijsturen, zelfde familie). **typographyStyle** minstens **elegant** of passend bij **artisan**; **vibe** **warm** of **rustic** of **artisan**.`,
      "- **Geen dominerende `bg-white` / klinisch wit** over halve pagina’s voor diensten, trust of testimonials — gebruik crème/zand/stone-warm (\`bg-stone-50\`, \`bg-amber-50/30\`, \`bg-[#f5e6d3]\`, subtiele gradient) en laat wit hooguit op **kleine kaartjes** of één contrastband.",
      "- **Eén visuele wereld:** wissel secties met tint, niet met willekeurige full-bleed stock (bijv. verf/klus) tenzij de briefing dat expliciet vraagt — barbier = stoel, spiegel, gereedschap, interieur.",
      "- Accent: **brons/goud/terracotta**, vermijd standaard fel SaaS-oranje tenzij de briefing dat zo noemt.",
    );
  }

  return lines.join("\n");
}

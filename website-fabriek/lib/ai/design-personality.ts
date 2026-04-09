import { z } from "zod";

/**
 * Stuurrichting voor layout-pools + promptregels.
 * Geen verwijzing naar concrete merken — alleen stijlkenmerken (juridisch veiliger dan “doe X als merk Y”).
 */
export const DESIGN_PERSONALITY_VALUES = [
  "bold_industrial",
  "elegant_luxury",
  "playful_creative",
  "minimal_tech",
  "editorial_art",
  "trust_conversion",
] as const;

export type DesignPersonality = (typeof DESIGN_PERSONALITY_VALUES)[number];

export const designPersonalitySchema = z.enum(DESIGN_PERSONALITY_VALUES);

export const PERSONALITY_RULES: Record<DesignPersonality, string> = {
  bold_industrial: `
- Sterke koppen (uppercase waar het past bij de toon), monospace voor cijfers/statistieken.
- Donkere basis + één felle accent (amber / oranje / rood) — geen pastel.
- Asymmetrie, overlap, robuuste fotografie (detail, proces, materiaal).
- Geen zachte verloop-overload; wel harde contrasten en duidelijke rasterbreuk.
`.trim(),
  elegant_luxury: `
- **Typografie:** serif op **displaykoppen**, sans op **body** (zoals preset \`typography.heading\` vs \`body\`) — dat is je luxe-signaal; niet alles in dezelfde geometrische sans.
- **Kleur:** gedempt messing/amber/brons op donker — vermijd plat **safety-oranje** en koud neon; warm off-white voor lange tekst i.p.v. hard wit overal.
- **Randen & ritme:** wissel **niet** overal dezelfde \`rounded-2xl\`-kaart; combineer hairline (\`ring\`/\`border\` met lage opacity), één scherp(er) kader, of beeld dat uit het kader loopt. Editorial = contrast in **vorm**, niet alleen in tekstgrootte.
- Italic/spacing voor tagline of pull-quote; royale lucht. Subtiele schaduw/glow alleen waar het dramatisch helpt.
`.trim(),
  playful_creative: `
- Varierende schaal, felle maar gecontroleerde accenten (roze, geel, mint, paars — kies 1–2).
- Afgeronde knoppen (rounded-full), decoratieve cirkels/badges; bento of gebroken grid.
- Illustratieve of kleurrijke beelden; mag onverwacht, maar blijf leesbaar.
`.trim(),
  minimal_tech: `
- Strak sans, duidelijke hiërarchie; bij **licht + B2C/leisure** (zwemmen, park, sport): iets **vriendelijker** radius (pill/rounded-full knopen) en **tweede accent** uit preset (teal + warm highlight) — nog steeds geen speelgoed.
- Veel lucht; dunne lijnen; sterke fotografie i.p.v. alleen icoonkaarten.
- Geen decoratie-overload; wél contrast tussen banden (beeld vs type).
`.trim(),
  editorial_art: `
- Expressieve typografie (mixed case), magazine-achtige grids, tekst over beeld in hero.
- Portret- en sfeerbeelden; durf witruimte en ongelijke kolommen.
- **Canvas-gedrag:** secties mogen “open” aanvoelen (geen kader om elke paragraaf); gebruik lijnen/borders spaarzaam; hiërarchie via schaal en ritme.
`.trim(),
  trust_conversion: `
- Functioneel, scanbaar; social proof groot (cijfers, reviews, logo’s, guarantees).
- Checkmarks/badges; meerdere duidelijke CTA’s **verdeeld over de pagina** (niet standaard allemaal in de hero); hoge contrast op acties.
- Geen gimmicks die vertrouwen ondermijnen.
`.trim(),
};

export function formatPersonalityPromptBlock(personality: DesignPersonality): string {
  return `=== DESIGN PERSONALITY (richting — \`_site_config.personality\`) ===

**personality:** \`${personality}\`

**Vertaal dit in copy, compositie en preset-gebruik (eigen interpretatie binnen technische contractregels):**

${PERSONALITY_RULES[personality]}
`;
}

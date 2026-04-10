import {
  STUDIO_BOOKING_PATH_PLACEHOLDER,
  STUDIO_PORTAL_PATH_PLACEHOLDER,
  STUDIO_SHOP_PATH_PLACEHOLDER,
} from "@/lib/site/studio-section-visibility";

/**
 * Eén studio-product: marketing + alle eerder “premium/custom”-opties in één prompt.
 * `generation_package` in de DB is vast `studio` (legacy waarden worden genormaliseerd).
 */

export const STUDIO_GENERATION_PACKAGE = "studio" as const;
export type GenerationPackageId = typeof STUDIO_GENERATION_PACKAGE;
export const GENERATION_PACKAGES = [STUDIO_GENERATION_PACKAGE] as const;

const LEGACY_TO_STUDIO: Record<string, GenerationPackageId> = {
  standalone: STUDIO_GENERATION_PACKAGE,
  basis: STUDIO_GENERATION_PACKAGE,
  premium: STUDIO_GENERATION_PACKAGE,
  custom: STUDIO_GENERATION_PACKAGE,
  starter: STUDIO_GENERATION_PACKAGE,
  elite: STUDIO_GENERATION_PACKAGE,
};

export const GENERATION_PACKAGE_LABELS: Record<GenerationPackageId, string> = {
  studio: "Site studio",
};

export const GENERATION_PACKAGE_DESCRIPTIONS: Record<GenerationPackageId, string> = {
  studio:
    "Eén generator: professionele marketingpagina, werkende links, optioneel zakelijk portaal-mock, WhatsApp/chat-placeholders en maatwerk uit de briefing — alles in één flow.",
};

/** Korte uitleg voor het admin-dashboard. */
export const STUDIO_PRODUCT_INFO = {
  positioning:
    "Iedere klant krijgt dezelfde rijke studio: marketing, portaal-secties waar passend, integratie-placeholders uit de briefing.",
  siteDelivers: [
    "Landingspagina als tailwind_sections: HTML-secties + thema (`config`) — omvang volgt briefing en gedetecteerde sectie-id's",
    "Optioneel `data-studio-visibility=\"portal\"` op secties voor zakelijke mocks + placeholders naar portaal en boeken",
    "WhatsApp / chat / extra secties volgens briefing (statisch, geen verborgen scripts)",
  ],
  inAdminApp: ["Site studio", "HTML-editor", "Klantportaal-route `/portal/{slug}` waar van toepassing"],
} as const;

export const STUDIO_ENVIRONMENT_NOTE =
  "Er is één Next.js-app + Supabase. Geen tier-pakketten meer: `generation_package` is vast `studio`; het verschil zit in briefing en commerciële velden (plan, betaling), niet in een apart AI-pakket.";

export function isGenerationPackageId(s: string | null | undefined): s is GenerationPackageId {
  return s === STUDIO_GENERATION_PACKAGE;
}

export function normalizeGenerationPackageId(s: string | null | undefined): GenerationPackageId {
  if (s == null || s === "") return STUDIO_GENERATION_PACKAGE;
  if (s === STUDIO_GENERATION_PACKAGE) return STUDIO_GENERATION_PACKAGE;
  if (s in LEGACY_TO_STUDIO) return LEGACY_TO_STUDIO[s]!;
  return STUDIO_GENERATION_PACKAGE;
}

const PORTAL_MARKUP_RULES = `=== ZAKELIJK PORTAAL — MARKERING (verplicht) ===
- HTML van **zakelijk portaal / factuur-overzicht / ondernemer-dashboard / boekingsflow / klant-dashboard** mag **alleen** binnen secties waar het **buitenste** \`<section>\` (of de eerste grote content-wrapper) het attribuut \`data-studio-visibility="portal"\` heeft.
- **Marketing** (hero, diensten, contact, FAQ, footer, …): **geen** \`portal\`-attribuut (publiek).
- Knoppen en nav-links naar het echte portaal (achter login op deze app): gebruik **exact** \`href="${STUDIO_PORTAL_PATH_PLACEHOLDER}"\` — géén \`#\` of verzonnen URL voor het portaal-pad.
- Blijft **statische** mock; geen \`<script>\`, geen echte login-flow in HTML.`;

const MARKETING_LINKS_COPY = `- **Links & id’s:** elke \`<a>\` heeft een **werkend** doel: intern \`#sectie-id\` (komt overeen met \`id\` op secties), \`mailto:\`, \`tel:\`, \`https://…\`, of de **interne pad-placeholders** (alleen in \`href\`, nooit als zichtbare tekst): portaal \`href="${STUDIO_PORTAL_PATH_PLACEHOLDER}"\`, publiek boeken \`href="${STUDIO_BOOKING_PATH_PLACEHOLDER}"\`, webshop \`href="${STUDIO_SHOP_PATH_PLACEHOLDER}"\` — **geen** \`href="#"\` of lege links voor die doelen.
- **Verboden op publieke marketing:** login, registratie, wachtwoordvelden, “mijn account” als werkende app — wel mag je **naar** het portaal linken met het portaal-placeholder.
- **Boeken-sectie:** lever **geen** sectie met \`id: "booking"\` in je JSON — die wordt **altijd** server-side toegevoegd. Dubbel = verboden.
- **Shop-sectie:** lever **geen** sectie met \`id: "shop"\` in je JSON — de studio voegt **vier producttegels** + webshop-CTA server-side toe. Dubbel = verboden.
- **Online afspraak (bezoeker):** als de briefing afspraken / online boeken noemt, zet het boekings-placeholder op één of twee plekken in **nav en/of footer**. Geen aparte booking-sectie bouwen; niet verwarren met het portaal-placeholder.
- **Webshop / online winkel:** bij retail-, product- of webshop-signalen in de briefing: **minstens één** link in **nav en/of footer** met het webshop-placeholder (bv. “Webshop”). Zonder duidelijk verkoopsignaal mag je die link weglaten.
- **Copy:** professioneel en menselijk; **vermijd** woorden als “AI”, “gegenereerd”, “prompt” of “chatbot-engine” in zichtbare tekst voor bezoekers — en **nooit** de ruwe placeholder-tokens als leesbare tekst op de pagina.`;

/** Vrije generatie: sectielijst in STUDIO STRUCTUUR is exhaustief. */
const MARKETING_CORE_FREE = `**SITE STUDIO (één product — geen tier-pakketten)**

**Structuur (vrije generatie):** De sectie-\`id\`'s in \`_site_config.sections\` (zelfde volgorde als in de studio-sectielijst / §5) zijn **exhaustief**. Je \`sections\`-array bevat **uitsluitend** die \`id\`'s — **geen** extra marketingsecties, **geen** verzonnen \`id\`'s. FAQ, testimonials en pricing **alleen** als het bijbehorende \`id\` in die lijst staat. Vul elk blok rijk uit.

${MARKETING_LINKS_COPY}`;

/** Upgrade: gemergde lijst = bron + geplande uitbreiding; bronrijen eerst ongewijzigd (zie ook §1). */
const MARKETING_CORE_UPGRADE = `**SITE STUDIO (één product — geen tier-pakketten)**

**Structuur (upgrade — prioriteit, onverbiddelijk):**
1. **Bron eerst:** Alle secties uit de bron-JSON blijven staan: **zelfde** \`id\`, **zelfde** \`html\`, **zelfde onderlinge volgorde** van die rijen als in de bron (zie §1).
2. **Gemergde lijst = enige waarheid:** \`_site_config.sections\` in dit bericht is de **gemergde** lijst (bestaande site + geplande id's uit de interpreter). Elke marketingsectie in je output heeft een \`id\` dat **in precies die lijst** voorkomt.
3. **Nieuwe rijen:** Voeg **alleen** \`sections\`-rijen toe voor \`id\`'s die **wel** in de gemergde lijst staan en **nog niet** in de bron-JSON, en **alleen** als de briefing of upgrade-opdracht dat **expliciet** verlangt. **Verboden:** elk \`id\` buiten de gemergde lijst; marketingsecties toevoegen “op gevoel”.

${MARKETING_LINKS_COPY}`;

const PORTAL_AND_MOCKS = `${PORTAL_MARKUP_RULES}

- Naast de **publieke** pagina, voeg waar het de briefing ondersteunt **portaal-gemarkeerde** secties toe (\`data-studio-visibility="portal"\`):
  - **Zakelijk portaal mock:** facturen/overzicht/documenten (kaarten, placeholders).
  - **Boeken / afspraken (ondernemer-mock):** statische UI in portaal-sectie mag; op de **publieke** marketingpagina geen eigen \`id: "booking"\`-sectie — alleen nav/footer-links met \`href="${STUDIO_BOOKING_PATH_PLACEHOLDER}"\` waar passend; geen nep-formulier dat data post.
  - **Klant-dashboard mock** (“Mijn afspraken”, placeholders) waar passend.
- Op de **publieke** marketingpagina: duidelijke link in header/footer naar het portaal met \`href="${STUDIO_PORTAL_PATH_PLACEHOLDER}"\` (bv. “Zakelijk portaal” of “Inloggen ondernemers”).
- Publieke nav: **geen** volledige dashboard-HTML buiten de gemarkeerde portal-secties.
- **Verboden:** werkende backend, database-koppelingen in HTML, \`<script>\` voor echte auth.`;

const BRIEFING_EXTRAS_FREE = `=== MAATWERK UIT BRIEFING (aanvullend) ===
- Gebruik de **bedrijfsomschrijving/briefing** voor tone of voice, copy, nadruk, sectoren en integratie-placeholders **binnen** de vaste sectie-\`id\`'s — **geen** structurele uitbreiding: **geen** nieuwe marketingsectie-\`id\`'s buiten \`_site_config.sections\`.
- **WhatsApp:** als een telefoonnummer in de briefing staat, gebruik **klikbare** links \`https://wa.me/<landcode+nummer zonder +>\` op vaste knoppen of floating actie; anders generieke “Neem contact op” zonder fake nummer.
- **Chat / chatbot:** bouw **statische** placeholder (kaart, “Start gesprek”, openingstijden) of duidelijk “Binnenkort beschikbaar” — **geen** ingesloten third-party \`<script>\` tenzij de briefing een **concrete** embed-URL noemt (dan mag één \`<iframe>\` met die src, geen extra scripts).
- Positioneer alles als **vakmanschap en maatwerk**; nooit verklappen dat content automatisch is geproduceerd.`;

const BRIEFING_EXTRAS_UPGRADE = `=== MAATWERK UIT BRIEFING (aanvullend) ===
- Gebruik de **bedrijfsomschrijving/briefing** voor inhoud en toon. **Nieuwe** marketingsecties **alleen** als de briefing of upgrade-opdracht dat **expliciet** vraagt **en** het \`id\` **in de gemergde** sectielijst (\`_site_config.sections\` / §5-hint) staat — anders **niet** toevoegen.
- **WhatsApp:** als een telefoonnummer in de briefing staat, gebruik **klikbare** links \`https://wa.me/<landcode+nummer zonder +>\` op vaste knoppen of floating actie; anders generieke “Neem contact op” zonder fake nummer.
- **Chat / chatbot:** bouw **statische** placeholder (kaart, “Start gesprek”, openingstijden) of duidelijk “Binnenkort beschikbaar” — **geen** ingesloten third-party \`<script>\` tenzij de briefing een **concrete** embed-URL noemt (dan mag één \`<iframe>\` met die src, geen extra scripts).
- Positioneer alles als **vakmanschap en maatwerk**; nooit verklappen dat content automatisch is geproduceerd.`;

export type GetGenerationPackagePromptBlockOptions = {
  /** `true` = upgrade / behoud lay-out: gemergde sectielijst + bron-eerst-regels. */
  preserveLayoutUpgrade?: boolean;
};

/** Volledige §0B-blok voor Claude (voorheen samengevoegd uit alle pakketten). */
export function getGenerationPackagePromptBlock(
  _id?: GenerationPackageId,
  options?: GetGenerationPackagePromptBlockOptions,
): string {
  const preserve = Boolean(options?.preserveLayoutUpgrade);
  const marketing = preserve ? MARKETING_CORE_UPGRADE : MARKETING_CORE_FREE;
  const briefing = preserve ? BRIEFING_EXTRAS_UPGRADE : BRIEFING_EXTRAS_FREE;
  return `${marketing}

${PORTAL_AND_MOCKS}

${briefing}`;
}


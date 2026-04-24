import {
  STUDIO_DATA_ATTR_FEATURE_ZONE,
  STUDIO_DATA_ATTR_MODULE,
  STUDIO_DATA_ATTR_MODULE_CTA,
  STUDIO_DATA_ATTR_NAV_MODULE,
} from "@/lib/site/public-site-modules-registry";
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

function buildMarketingLinksCopy(appointmentsEnabled: boolean, webshopEnabled: boolean): string {
  const base = `- **Links & id’s:** elke \`<a>\` heeft een **werkend** doel: intern \`#sectie-id\` (komt overeen met \`id\` op secties **van dezelfde pagina**), \`mailto:\`, \`tel:\`, \`https://…\`, of **interne pad-placeholders** (alleen in \`href\`, nooit als zichtbare tekst): marketing-subroutes \`href="__STUDIO_SITE_BASE__/<slug>"\` (slug komt overeen met de keys in \`marketingPages\` voor deze run, bv. \`wat-wij-doen\`, \`collectie\`, \`faq\`) wanneer de site \`marketingPages\` gebruikt, portaal \`href="${STUDIO_PORTAL_PATH_PLACEHOLDER}"\` — **geen** \`href="#"\` of lege links. **FAQ:** link \`__STUDIO_SITE_BASE__/faq\` hoort in de **footer**, **niet** in de top-\`<header>\`-nav.
- **Geen dubbele conversie-UI:** zelfde twee hoofdknoppen (bijv. shop/assortiment + contact) **niet** opnieuw als tweede full-bleed “eind-hero” vlak boven de footer; **geen** aparte \`id: "gallery"\` voor productrasters als het om verkoop/webshop gaat — dat is rommelig naast de echte shop-module.
- **Marketing-subpagina’s (\`marketingPages\`):** in de **pagina-body buiten \`<header>\`** hoogstens **één** primaire **contact**-knop naar \`__STUDIO_CONTACT_PATH__\` (zelfde stijl: vol accentvlak, grote padding) — meestal alleen in de **onderste afsluitband** (“Neem contact op” / “Contact opnemen”). **Verboden:** nog een tweede identieke oranje/contact-knop hoger op dezelfde pagina (bijv. bij de laatste stap van een werkwijze / “oplevering & nazorg”); daar hoogstens **tekstlink** of anker naar die afsluiter, **geen** dubbele knop.`;

  const modulesOff = `- **Boeking & webshop (publieke marketing — CRM-modules staan in deze run UIT):** lever **geen** sectie \`id: "booking"\` of \`id: "shop"\`; **geen** \`href="${STUDIO_BOOKING_PATH_PLACEHOLDER}"\`, **geen** \`href="${STUDIO_SHOP_PATH_PLACEHOLDER}"\`, en **geen** \`${STUDIO_DATA_ATTR_MODULE}\` / \`${STUDIO_DATA_ATTR_FEATURE_ZONE}\` / \`${STUDIO_DATA_ATTR_NAV_MODULE}\` / \`${STUDIO_DATA_ATTR_MODULE_CTA}\` voor appointments of webshop — die schakelt de beheerder later in en voegt vaste blokken toe **na** generatie. Gebruik desnoods neutrale CTA’s (\`#contact\`, \`mailto:\`, \`tel:\`) voor “neem contact op”.`;

  const parts: string[] = [base];
  if (!appointmentsEnabled && !webshopEnabled) {
    parts.push(modulesOff);
  } else {
    parts.push(
      `- **Boeking & webshop (publieke marketing — CRM-modules in deze run):**`,
      ...(appointmentsEnabled
        ? [
            `  - **Online afspraken AAN:** zet op alle relevante primaire conversieplekken (vaste header/topnav, mobiel menu, **hero** wanneer de briefing reserveren/afspraken benadrukt, footer) minstens **één** duidelijke knop of link (bv. “Reserveer”, “Maak een afspraak”, “Boek online”) met \`href="${STUDIO_BOOKING_PATH_PLACEHOLDER}"\` — **exact dit token**, geen \`#contact\`, geen verzonnen pad als \`/booking-app/book/…\`. Secundair “Bel / WhatsApp” mag \`tel:\` of \`https://wa.me/…\` blijven; de **hoofd**-reserveeractie gebruikt het boekings-token.`,
          ]
        : []),
      ...(webshopEnabled
        ? [
            `  - **Webshop AAN:** minstens **één** duidelijke “winkel / bestellen / shop”-link in nav en/of hero en/of footer met \`href="${STUDIO_SHOP_PATH_PLACEHOLDER}"\` — **exact dit token**, geen nep-\`/winkel/…\`-pad.`,
          ]
        : []),
      `  - **Geen** ingesloten agenda-widget, geen booking-\`<iframe>\`, geen checkout-\`<form>\` op de marketingpagina dat naar een verzonnen endpoint post. **Geen** rijke marketingsectie \`id: "booking"\` of \`id: "shop"\` met echte module-UI — het platform voegt minimaal canonieke ankertellingen toe bij opslaan; jij levert zichtbare **juiste \`href\`-placeholders**.`,
      `  - **Handmatig** \`${STUDIO_DATA_ATTR_MODULE}\` / \`${STUDIO_DATA_ATTR_FEATURE_ZONE}\` / \`${STUDIO_DATA_ATTR_NAV_MODULE}\` / \`${STUDIO_DATA_ATTR_MODULE_CTA}\` **niet** toevoegen tenzij de **bron-JSON** bij upgrade die al had — het platform tagt \`href\`-placeholders bij publicatie.`,
    );
  }

  parts.push(
    `- **Upgrade met bron-JSON:** als de bron al booking/shop-placeholders of module-attrs bevat, **kopieer** die markup **ongewijzigd** op de betreffende rijen (geen extra dubbele booking/shop-secties toevoegen).`,
    `- **Verboden op publieke marketing:** login, registratie, wachtwoordvelden, “mijn account” als werkende app — wel mag je **naar** het portaal linken met het portaal-placeholder.`,
    `- **Copy:** professioneel en menselijk; **vermijd** woorden als “AI”, “gegenereerd”, “prompt” of “chatbot-engine” in zichtbare tekst voor bezoekers — en **nooit** de ruwe placeholder-tokens als leesbare tekst op de pagina.`,
  );

  return parts.join("\n");
}

function buildMarketingCoreFree(marketingLinks: string): string {
  return `**SITE STUDIO (één product — geen tier-pakketten)**

**Structuur (vrije generatie):** De sectie-\`id\`'s in \`_site_config.sections\` (zelfde volgorde als in de studio-sectielijst / §5) zijn **exhaustief**. Je \`sections\`-array bevat **uitsluitend** die \`id\`'s — **geen** extra marketingsecties, **geen** verzonnen \`id\`'s. FAQ, testimonials en pricing **alleen** als het bijbehorende \`id\` in die lijst staat. Vul elk blok rijk uit.

${marketingLinks}`;
}

function buildMarketingCoreUpgrade(marketingLinks: string): string {
  return `**SITE STUDIO (één product — geen tier-pakketten)**

**Structuur (upgrade — prioriteit, onverbiddelijk):**
1. **Bron eerst:** Alle secties uit de bron-JSON blijven staan: **zelfde** \`id\`, **zelfde** \`html\`, **zelfde onderlinge volgorde** van die rijen als in de bron (zie §1).
2. **Gemergde lijst = enige waarheid:** \`_site_config.sections\` in dit bericht is de **gemergde** lijst (bestaande site + geplande id's uit de interpreter). Elke marketingsectie in je output heeft een \`id\` dat **in precies die lijst** voorkomt.
3. **Nieuwe rijen:** Voeg **alleen** \`sections\`-rijen toe voor \`id\`'s die **wel** in de gemergde lijst staan en **nog niet** in de bron-JSON, en **alleen** als de briefing of upgrade-opdracht dat **expliciet** verlangt. **Verboden:** elk \`id\` buiten de gemergde lijst; marketingsecties toevoegen “op gevoel”.

${marketingLinks}`;
}

function buildPortalAndMocks(appointmentsEnabled: boolean, webshopEnabled: boolean): string {
  const bookingPortalLine = appointmentsEnabled
    ? `  - **Boeken / afspraken (ondernemer-mock):** statische UI in portaal-sectie mag. Op de **publieke** marketingpagina: **geen** volwaardige \`id: "booking"\`-sectie met formulier of widget; **wel** reserveer-/boek-CTA’s met exact \`href="${STUDIO_BOOKING_PATH_PLACEHOLDER}"\` zoals in het blok “Boeking & webshop” hierboven. Geen nep-formulier op de marketingpagina dat data post.`
    : `  - **Boeken / afspraken (ondernemer-mock):** statische UI in portaal-sectie mag; op de **publieke** marketingpagina **geen** \`id: "booking"\` en **geen** \`href="${STUDIO_BOOKING_PATH_PLACEHOLDER}"\` in nieuwe builds wanneer de module uit staat (zie CRM-blok). Geen nep-formulier op de marketingpagina dat data post.`;

  const shopPortalNote =
    webshopEnabled && !appointmentsEnabled
      ? `  - **Webshop (ondernemer-mock):** statische UI in portaal-sectie mag; op de **publieke** marketingpagina **geen** \`id: "shop"\` met checkout — gebruik \`href="${STUDIO_SHOP_PATH_PLACEHOLDER}"\` voor shop-links zoals in het CRM-blok.`
      : webshopEnabled && appointmentsEnabled
        ? `  - **Webshop (ondernemer-mock):** zelfde scheiding als booking: publiek = placeholders in nav/hero/footer; geen echte checkout-HTML op de marketingpagina.`
        : "";

  return `${PORTAL_MARKUP_RULES}

- Naast de **publieke** pagina, voeg waar het de briefing ondersteunt **portaal-gemarkeerde** secties toe (\`data-studio-visibility="portal"\`):
  - **Zakelijk portaal mock:** facturen/overzicht/documenten (kaarten, placeholders).
${bookingPortalLine}${shopPortalNote ? `\n${shopPortalNote}` : ""}
  - **Klant-dashboard mock** (“Mijn afspraken”, placeholders) waar passend.
- Op de **publieke** marketingpagina: **één** link naar het portaal met \`href="${STUDIO_PORTAL_PATH_PLACEHOLDER}"\` (bv. “Portaal”, “Zakelijk portaal” of “Inloggen ondernemers”) — **uitsluitend in de footer**, bij de andere footer-navigatielinks (zelfde rij of linkgroep als Diensten / FAQ / Contact). **Verboden in header/topnav:** geen portaal-link in de primaire navigatiebalk of mobiele menu-header — dat is voor bezoekers onnodig zichtbaar; de eigenaar vindt het portaal in de footer. **Verboden:** geïsoleerd helemaal rechtsonder naast kleine copyright-/signature-tekst; **verboden:** één doorlopende zichtbare zin als \`Zakelijk portaal by GENTRIX\` — de studio voegt een aparte **By GENTRIX**-signatuur toe; jij levert alleen de portaal-linktekst + \`href\`.
- Publieke nav: **geen** volledige dashboard-HTML buiten de gemarkeerde portal-secties.
- **Verboden:** werkende backend, database-koppelingen in HTML, \`<script>\` voor echte auth.`;
}

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
  /**
   * `true` = model moet `__STUDIO_BOOKING_PATH__` op reserveer-/boek-CTA’s zetten (studio/CRM).
   * Standaard `false`/`undefined` = oude gedrag (geen boekingsplaceholder in nieuwe generatie).
   */
  appointmentsEnabled?: boolean;
  /** `true` = idem voor `__STUDIO_SHOP_PATH__`. */
  webshopEnabled?: boolean;
};

/** Volledige §0B-blok voor Claude (voorheen samengevoegd uit alle pakketten). */
const SITE_IR_VISUAL_SCOPE_NOTE = `=== Structuur vs. vormgeving (geen “visuele gevangenis”) ===
- De studio kan een **interne** site-IR (blueprint, module-slots, toggles) gebruiken voor **data en validatie** — dat is **geen** voorschrift voor jouw visuele ontwerp: typografie, spacing, kleuren, fotostijl en layout blijven afgeleid uit de briefing.
- **Markers en placeholders** (module-links, portaal-paden, zones) zijn technische verplichtingen waar de briefing om vraagt — geen kant-en-klare layout-template.`;

export function getGenerationPackagePromptBlock(
  _id?: GenerationPackageId,
  options?: GetGenerationPackagePromptBlockOptions,
): string {
  const preserve = Boolean(options?.preserveLayoutUpgrade);
  const appointmentsEnabled = options?.appointmentsEnabled === true;
  const webshopEnabled = options?.webshopEnabled === true;
  const marketingLinks = buildMarketingLinksCopy(appointmentsEnabled, webshopEnabled);
  const marketing = preserve ? buildMarketingCoreUpgrade(marketingLinks) : buildMarketingCoreFree(marketingLinks);
  const portalBlock = buildPortalAndMocks(appointmentsEnabled, webshopEnabled);
  const briefing = preserve ? BRIEFING_EXTRAS_UPGRADE : BRIEFING_EXTRAS_FREE;
  return `${marketing}

${portalBlock}

${briefing}

${SITE_IR_VISUAL_SCOPE_NOTE}`;
}


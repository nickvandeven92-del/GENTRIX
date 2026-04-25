/**
 * Gedeelde prompttekst: premium nav-chrome patronen (transparant → donkerder bij scroll).
 * Houd synchroon met `STUDIO_NAV_SCROLL_DIM_CSS` in `lib/site/tailwind-page-html.ts`.
 */
export function getStudioNavChromePatternLibraryPromptBlock(): string {
  return `=== NAV-CHROME BIBLIOTHEEK (optioneel) ===
**Geen verplichting:** dit blok is **alleen** een referentie voor ???transparant ??? donkerder bij scroll??? (NOIR/Lovable-achtig). Je mag de nav **volledig anders** ontwerpen: effen lichte of donkere balk **zonder** scroll-toggle, underline-tabs, segmented control, minimalistische tekstlinks, geen frosted, eigen \`@scroll.window\`-logica zonder \`studio-nav-scroll-dim\`, enz. **Varieer tussen generaties** ??? gebruik deze bibliotheek **niet** standaard op elke site.

De studio-shell laadt **optioneel** bruikbare utilities \`studio-nav-scroll-dim\` en \`studio-nav-scroll-dim--active\`. **Als** je dit patroon kiest: zet op de **zelfde** \`<header>\` (aanbevolen) of host-\`<nav>\` Alpine \`x-data\` + \`@scroll.window\` en toggle **alleen** de modifier-class **\`studio-nav-scroll-dim--active\`** wanneer \`window.scrollY\` (of \`document.documentElement.scrollTop\`) > **10** — dan wordt de balk **donkerder + frosted**; bovenaan blijft hij **transparant** (geen eigen \`<script>\` nodig).

**Patroon A — brede balk over full-bleed hero (NOIR-achtig)**
- Buitenste host: \`<header class="sticky top-0 z-50 studio-nav-scroll-dim border-b border-transparent …" x-data="{ navScrolled: false }" @scroll.window="navScrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 10" :class="{ 'studio-nav-scroll-dim--active': navScrolled }">\`
- Binnen: \`<div class="mx-auto flex max-w-7xl …">\` logo + desktop-links + mobiele knop; **geen** tweede \`x-data\` op de inner row als die dezelfde \`open\`-state deelt — hamburger-scope = deze \`<header>\`.

**Patroon B — zwevende pill / capsule (Lovable-achtig, gecentreerd)**
- Zelfde \`studio-nav-scroll-dim\` + \`:class\` op de **pill-host**: \`<header class="sticky top-0 z-50 mx-auto mt-4 flex max-w-5xl items-center justify-between gap-6 rounded-full border border-white/10 px-5 py-2.5 shadow-sm studio-nav-scroll-dim …" x-data="{ navScrolled: false }" @scroll.window="navScrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 10" :class="{ 'studio-nav-scroll-dim--active': navScrolled }">\`
- Op **licht** body achter de pill: gebruik \`text-slate-900\` op links in de niet-actieve staat; in **\`studio-nav-scroll-dim--active\`** zet de shell links automatisch licht — test contrast op jouw achtergrond.
- Alternatief met outer wrapper (alleen als je \`fixed\` echt nodig hebt): dunne wrapper \`fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 pointer-events-none\`, binnen \`<header class="pointer-events-auto … studio-nav-scroll-dim … w-full max-w-5xl rounded-full …">\` met dezelfde Alpine-toggle — **geen** tweede volledige menu eronder.

**Regels:** primaire nav blijft **\`sticky top-0\`** (studio-contract); **één** \`x-data\` op de nav-host; mobiel menu **gesloten** bij load. Combineer dit bibliotheek-patroon **niet** dubbel met \`data-gentrix-scroll-nav="1"\` op dezelfde tag (kies **of** Gentrix-home shell **of** dit patroon).`;
}

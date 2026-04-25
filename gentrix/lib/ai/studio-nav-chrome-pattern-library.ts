/**
 * **Alleen prompttekst** voor het AI-model: voorbeeld-markup en -gedrag.
 * Geen React/componenten, geen runtime registry, geen `studioNav`-schema hier, geen server-renderer —
 * dat zit in `lib/site/render-studio-nav-chrome-html.ts`, `infer-studio-nav-chrome.ts` en
 * `buildTailwindSectionsBodyInnerHtml`. Dit bestand beïnvloedt alleen instructies aan Claude.
 *
 * Alleen relevant als de primaire `<header>` **niet** door de studio wordt vervangen (legacy-config,
 * of master-Tailwind waar infer te weinig links vindt en de AI-nav blijft staan).
 * Houd synchroon met `STUDIO_NAV_SCROLL_DIM_CSS` in `lib/site/tailwind-page-html.ts`.
 */
export function getStudioNavChromePatternLibraryPromptBlock(): string {
  return `=== NAV-CHROME BIBLIOTHEEK (alleen legacy / geen declaratieve vervanging) ===
**Scope van dit blok:** uitsluitend **voorbeeldgedrag en voorbeeld-markup** voor het model — **geen** componentbibliotheek, **geen** runtime registry, **geen** declaratieve \`studioNav\`-config om zelf in JSON te vullen, **geen** beschrijving van de server-side renderer. De canonieke master-nav (thema, fixed shell, infer) wordt **buiten** dit blok door de studio opgebouwd; dit blok is alleen nuttig wanneer jouw primaire \`<header>\` in de output **blijft staan** (legacy of infer faalt).
**Master Tailwind + infer:** de zichtbare top-nav wordt door de **server** opgebouwd (thema + \`studioNav\`/infer). De eerste \`<header>\` in je JSON is dan alleen een **bron voor labels/hrefs** en verdwijnt bij publish — zet daar **geen** \`studio-nav-scroll-dim\`, **geen** \`@scroll.window\`-scrollstyling op de host, **geen** \`data-gentrix-scroll-nav\`, en **geen** volledig eigen mobiel Alpine-overlaypatroon op die host (dat conflicteert met de canonieke shell).

**Wanneer dit blok wél past:** oude tailwind-config zonder declaratieve nav, of een pagina waar de AI-header **blijft** staan omdat infer niet slaagt. Dan is dit **optioneel** (NOIR/Lovable-achtig: transparant → donkerder bij scroll). Je mag de nav ook **volledig anders** ontwerpen zonder deze utilities.

De studio-shell laadt **optioneel** \`studio-nav-scroll-dim\` + \`studio-nav-scroll-dim--active\`. **Als** je dit kiest op een **blijvende** primaire host: één \`x-data\` + \`@scroll.window\`, toggle **alleen** \`studio-nav-scroll-dim--active\` wanneer scrollTop > **10** (geen eigen \`<script>\`).

**Patroon A — brede balk**
- Host: \`<header class="sticky top-0 z-50 studio-nav-scroll-dim …" x-data="{ navScrolled: false }" @scroll.window="navScrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 10" :class="{ 'studio-nav-scroll-dim--active': navScrolled }">\`
- Binnen: \`<div class="mx-auto flex max-w-7xl …">\` logo + links + mobiele knop; **één** \`x-data\` voor hamburger-state.

**Patroon B — pill**
- Zelfde toggle op een **rounded-full** host met \`studio-nav-scroll-dim\`; op lichte achtergrond: \`text-slate-900\` op links in rust — test contrast.

**Regels (legacy):** primaire nav-host **\`sticky top-0\`** + duidelijke \`z-*\`; mobiel menu **gesloten** bij load. Combineer **niet** \`studio-nav-scroll-dim\` + \`data-gentrix-scroll-nav="1"\` op **dezelfde** tag (kies één mechanisme).`;
}

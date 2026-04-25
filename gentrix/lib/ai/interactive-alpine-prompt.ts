/**
 * Gedeelde prompttekst: Studio laadt Alpine.js 3 op preview, publicatie en export (tailwind_cdn).
 * Houd dit synchroon met lib/site/studio-alpine-cdn.ts en sanitize in tailwind-page-html.
 */
import { getStudioDefaultHeroVideoPromptBlock } from "@/lib/site/studio-default-hero-videos";
import { getStudioNavChromePatternLibraryPromptBlock } from "@/lib/ai/studio-nav-chrome-pattern-library";

export function getAlpineInteractivityPromptBlock(): string {
  return `=== INTERACTIVITEIT (Alpine.js 3, CDN) ===
De pagina laadt **Alpine.js** naast Tailwind. Gebruik **declaratieve** micro-interacties waar dat de UX merkbaar verbetert (FAQ-uitklap, mobiel menu, tabs, eenvoudige toggles) — niet overal tóévoegen.

**FAQ-marketingpagina (\`marketingPages["faq"]\`):** elke vraag moet een **zichtbaar antwoord** hebben dat **uitklapt** (bij voorkeur native \`<details><summary>vraag</summary>…antwoord…</details>\` per item — werkt ook zonder Alpine; anders Alpine \`x-data\` + \`@click\` + \`x-show\`). **Verboden:** alleen vragen/koppen zonder inklapbaar antwoordblok.

**Toegestaan in \`html\`:** \`x-data="…"\` (compacte state), \`x-show\`, \`x-cloak\`, \`x-transition\`, \`x-for\` (vaak op \`<template x-for="…">\`), \`x-model\`, \`x-text\`, \`x-bind\` en korte vorm \`:class\`, \`:id\`, \`@click\`, \`@submit.prevent\`, \`@scroll.window\`, enz.

**Verboden in fragmenten:** eigen \`<script>\` of \`<style>\`, klassieke inline handlers (\`onclick=\`, \`onchange=\`), \`javascript:\` links, en **\`x-html\`** (wordt uit sanitisatie verwijderd — gebruik \`x-text\` of vaste markup). **Belangrijk:** \`<style>\` en \`@keyframes\` in sectie-HTML worden bij preview/publicatie **volledig verwijderd** — gebruik ze niet. Voor gloed/hover: **Tailwind** (\`hover:shadow-*\`, \`hover:ring-*\`, \`transition\`, \`duration-*\`, \`group\`/\`group-hover:\`) of bestaande studio-markup zoals \`studio-laser-h\` / \`data-animation\` / \`data-aos\` (AOS). **GSAP** staat in de pagina-shell; geen eigen \`<script>\` in fragmenten — alleen targets (\`id\`/\`class\`) voor eventuele **Eigen JS** buiten dit JSON-fragment; voor eigen keyframes: de gebruiker moet **Eigen CSS** in de editor gebruiken.

**HTML — één \`class\` per element:**
- **Nooit** twee \`class="…"\` op dezelfde tag.
- Vaste Tailwind-utilities in **één** \`class="…"\`; dynamische klassen via \`:class="…"\` / \`x-bind:class\`.

**Menu’s / header (twee situaties):**
- **Master Tailwind (standaard site-generatie):** navigatie = **\`config.studioNav\`** + server-renderer (fixed shell, mobiel sheet). Voor briefingtermen als **“menulinks centreren / gecentreerde nav”**: zet \`studioNav.navBarLayout\` op \`"centeredLinks"\` (server past desktop-layout aan) ??? **niet** zelf een tweede \`<nav>\` met \`justify-center\` in sectie-HTML bouwen. Met \`config.studioShellNav: true\` is geldige \`studioNav\` verplicht en geldt **geen** legacy-infer uit AI-\`<header>\` (lek-chrome wordt gestript). Zonder die vlag: **geen** eigen top-\`<header>\`/\`<nav>\`-chrome in sectie-HTML tenzij \`studioNav\` ontbreekt (legacy-infer). **Geen** \`@scroll.window\`/\`studio-nav-scroll-dim\`/\`data-gentrix-scroll-nav\` op een zelfgebouwde header. Legacy: één simpele \`sticky\` bron-\`<header>\` met merk + \`<a>\` is oké voor infer.
- **Legacy / header blijft staan (geen vervanging):** **één** primaire site-nav — **geen** tweede menu met dezelfde \`href="#…"\`. Top-nav-host: \`sticky top-0\` + \`z-*\` (geen \`fixed\` top-bar als standaard-contract, behalve bewuste uitzonderingen in de briefing). Hamburger/overlay = dezelfde nav. Mobiel: sluiten na link, \`@click.outside\` waar logisch. **Verboden:** permanente zijbalk (\`fixed … h-full\`) naast de hoofdnav op desktop. **Z-index:** overlay/backdrop **strikt boven** de balk (\`z-[60]\` / \`z-[70]\`) zodat het menu niet “door” de nav scheurt.

**Mobiel menu — start altijd gesloten (legacy / blijvende nav):** Alpine-state voor hamburger/sheet/overlay **moet** op eerste paint **gesloten** zijn (bv. \`x-data="{ open: false }"\`, \`menuOpen: false\`, \`navOpen: false\`). **Nooit** \`open: true\` als default. **Op de master-bron-header** die infer vervangt: je hoeft **geen** eigen mobiel sheet te bouwen — desktop-links mogen \`hidden lg:flex\`; de renderer levert hamburger + sheet.

**Mobiel togglen — één knop (legacy / blijvende nav):** **één** \`type="button"\` met \`@click="open = !open"\` (of \`@click="menuOpen = !menuOpen"\`). **Gesloten:** drie **platte, gelijke** horizontale streepjes. **Open:** hetzelfde knopvlak toont een **X**. **Geen** tweede losse sluitknop in de header; sluiten = zelfde knop of backdrop-klik.

**Alpine-scope (legacy / blijvende nav):** zet \`x-data="{ … }"\` op **\`<header>\`** of op **één** parent rond hamburger + \`x-show\`-sheet. **Fout patroon:** \`x-data\` verkeerd genest → hamburger en × **tegelijk** zichtbaar.

**Mobiel menu — contrast (legacy / blijvende nav):** donkere sheet/overlay: expliciet lichte linktekst (\`text-white\`, enz.) — anders onzichtbaar op \`body\` \`text-slate-900\`.

**Leesbaarheid:** op een **blijvende** nav-host: glass/transparantie vraagt contrast (bijv. \`:class\` + scroll). Op de **master-bron-header**: geen scroll-scripts op de host; contrast in de gerenderde chrome regelt de studio.

**Nav-vorm op de bron-header (vrij):** balk vs. pill-look mag per site verschillen (infer leest o.a. \`rounded-full\`). Bij **multipage**: dezelfde **inhoud** (merk + links) op alle routes (zie kernprompt 3B).

${getStudioNavChromePatternLibraryPromptBlock()}

**Formulieren:** \`<form>\` met \`@submit.prevent\` mag voor UX (bijv. "bedankt"-toggle); echte server-POST is niet standaard — gebruik \`mailto:\`, \`tel:\`, \`https://\` of ankers naar \`#contact\` tenzij de briefing expliciet anders vraagt. Geen fictieve API-routes als harde afhankelijkheid.

${getStudioDefaultHeroVideoPromptBlock()}`;
}

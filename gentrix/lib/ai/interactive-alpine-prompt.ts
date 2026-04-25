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

**Menu’s / header:** **één** primaire site-nav voor de hele pagina — **geen** tweede menu met dezelfde \`href="#…"\`-links (geen verticale dubbele lijst naast de topbar). De **top-nav-host** (buitenste \`<header>\` of primaire \`<nav>\`) gebruikt **altijd** \`sticky top-0\` + duidelijke \`z-*\` — **geen** \`fixed\` top-bar; vorm (pill, blur, kleur) blijft vrij. Hamburger/overlay = dezelfde nav, geen kopie. Mobiel uitklapmenu: **sluiten** na linkklik en bij klik buiten waar logisch (\`@click.outside\`). **Verboden patroon:** een permanente zijbalk-nav (\`fixed top-0 right-0 h-full\` of \`fixed … left-0 … h-full\`) die op desktop naast de hoofdnav zichtbaar blijft. **Z-index:** de top-nav heeft typisch \`z-50\`; het **mobiele menu** (backdrop \`fixed inset-0\`, sheet \`fixed … h-full\`, enz.) moet **strikt hogere** \`z-*\` hebben (bijv. backdrop \`z-[60]\`, sheet \`z-[70]\`) zodat overlay en sluitknop **boven** de balk liggen — anders blijft de navbar zichtbaar “door” het open menu.

**Mobiel menu — start altijd gesloten:** Alpine-state voor hamburger/sheet/overlay **moet** op eerste paint **gesloten** zijn (bv. \`x-data="{ open: false }"\`, \`menuOpen: false\`, \`navOpen: false\`). **Nooit** \`open: true\` / \`menuOpen: true\` als default — bezoekers zien dan een volscherm-menu vóór ze tikken. Gebruik **plat object** in \`x-data="…"\` (geen \`x-data="fn()"\` dat \`open: true\` teruggeeft). Overlay/panel: \`x-show="open"\` (of \`:class\`) + eventueel \`x-cloak\` (de studio injecteert \`[x-cloak]{display:none!important}\` in preview/export) om flitsen te voorkomen. Op **brede** breakpoints (\`lg:\`+): horizontale links **zichtbaar** zonder eerst menu te openen.

**Mobiel togglen — één knop:** **één** \`type="button"\` met \`@click="open = !open"\` (of \`@click="menuOpen = !menuOpen"\`). **Gesloten:** drie **platte, gelijke** horizontale streepjes (zelfde breedte/dikte, strak gespatieerd). **Open:** hetzelfde knopvlak toont een **X** uit twee dunne kruisende lijnen (geen los typografisch teken naast de hamburger) — past bij donkere/lichte header. **Geen** tweede losse sluitknop in de header; sluiten = zelfde knop of backdrop-klik.

**Alpine-scope (verplicht):** zet \`x-data="{ … }"\` op **\`<header>\`** (aanbevolen) of op **één** parent die **zowel** de hamburger-knop **als** alle \`x-show\` / \`@click\` gebruikt die diezelfde state togglen (inclusief streepjes vs. × in dezelfde knop). **Fout patroon:** knop met \`@click\` en spans met \`x-show="!open"\` / \`x-show="open"\` terwijl \`x-data\` alleen op een **ander** takje van de header staat (of ontbreekt) — dan bindt Alpine niet, doet de knop niets en kunnen **hamburger en × tegelijk** zichtbaar blijven.

**Mobiel menu — contrast:** de pagina-shell heeft \`text-slate-900\` op \`body\`; elke link in een **donkere** sheet/overlay moet expliciet lichte tekst hebben (bv. \`text-white\`, \`text-white/90\`, \`hover:bg-white/10\`) — anders erven ankers de donkere bodykleur en zijn ze op zwart **onzichtbaar**.

**Leesbaarheid:** transparante of glass header over wisselende achtergronden: zorg **functioneel** voor contrast (bijv. \`:class\` op scroll, \`@scroll.window\`) — **geen** verplichte nav-stijl.

**Nav-vorm (vrij):** elke generatie mag een **ander** nav-archetype kiezen (effen, ghost, pill, segmented, minimal links, geen scroll-dimming, ???). Alleen bij **multipage** geldt apart de regel ???**dezelfde** chrome **binnen** ??n site op alle routes??? (zie kernprompt 3B) ??? dat is **niet** ???elke run dezelfde nav als de vorige site???.

${getStudioNavChromePatternLibraryPromptBlock()}

**Formulieren:** \`<form>\` met \`@submit.prevent\` mag voor UX (bijv. "bedankt"-toggle); echte server-POST is niet standaard — gebruik \`mailto:\`, \`tel:\`, \`https://\` of ankers naar \`#contact\` tenzij de briefing expliciet anders vraagt. Geen fictieve API-routes als harde afhankelijkheid.

${getStudioDefaultHeroVideoPromptBlock()}`;
}

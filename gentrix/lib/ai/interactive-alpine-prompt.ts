/**
 * Gedeelde prompttekst: Studio laadt Alpine.js 3 op preview, publicatie en export (tailwind_cdn).
 * Houd dit synchroon met lib/site/studio-alpine-cdn.ts en sanitize in tailwind-page-html.
 */
import { getStudioDefaultHeroVideoPromptBlock } from "@/lib/site/studio-default-hero-videos";

export type AlpineInteractivityPromptOptions = {
  /** Zelfde waarde als site-generatie `varianceNonce` → andere volgorde standaard hero-MP4’s in de prompt. */
  defaultHeroVideoOrderSeed?: string;
};

export function getAlpineInteractivityPromptBlock(opts?: AlpineInteractivityPromptOptions): string {
  return `=== INTERACTIVITEIT (Alpine.js 3, CDN) ===
De pagina laadt **Alpine.js** naast Tailwind. Gebruik **declaratieve** micro-interacties waar dat de UX merkbaar verbetert (FAQ-uitklap, mobiel menu, tabs, eenvoudige toggles) — niet overal tóévoegen.

**Toegestaan in \`html\`:** \`x-data="…"\` (compacte state), \`x-show\`, \`x-cloak\`, \`x-transition\`, \`x-for\` (vaak op \`<template x-for="…">\`), \`x-model\`, \`x-text\`, \`x-bind\` en korte vorm \`:class\`, \`:id\`, \`@click\`, \`@submit.prevent\`, \`@scroll.window\`, enz.

**Verboden in fragmenten:** eigen \`<script>\` of \`<style>\`, klassieke inline handlers (\`onclick=\`, \`onchange=\`), \`javascript:\` links, en **\`x-html\`** (wordt uit sanitisatie verwijderd — gebruik \`x-text\` of vaste markup). **Belangrijk:** \`<style>\` en \`@keyframes\` in sectie-HTML worden bij preview/publicatie **volledig verwijderd** — gebruik ze niet. Voor gloed/hover: **Tailwind** (\`hover:shadow-*\`, \`hover:ring-*\`, \`transition\`, \`duration-*\`, \`group\`/\`group-hover:\`) of bestaande studio-markup zoals \`studio-laser-h\` / \`data-animation\` / \`data-aos\` (AOS). **GSAP** staat in de pagina-shell; geen eigen \`<script>\` in fragmenten — alleen targets (\`id\`/\`class\`) voor eventuele **Eigen JS** buiten dit JSON-fragment; voor eigen keyframes: de gebruiker moet **Eigen CSS** in de editor gebruiken.

**HTML — één \`class\` per element:**
- **Nooit** twee \`class="…"\` op dezelfde tag.
- Vaste Tailwind-utilities in **één** \`class="…"\`; dynamische klassen via \`:class="…"\` / \`x-bind:class\`.

**Menu’s / header:** **één** primaire site-nav voor de hele pagina — **geen** tweede menu met dezelfde \`href="#…"\`-links (geen verticale dubbele lijst naast de topbar). Vorm verder **vrij** (sticky balk, pill, \`fixed\` overlay, minimaal). Hamburger/overlay = dezelfde nav, geen kopie. Mobiel uitklapmenu: **sluiten** na linkklik en bij klik buiten waar logisch (\`@click.outside\`). **Z-index:** als de top-nav \`fixed\` is met \`z-50\` (of vergelijkbaar), moet het **mobiele menu** (backdrop \`fixed inset-0\`, sheet \`fixed … h-full\`, enz.) **strikt hogere** \`z-*\` hebben (bijv. backdrop \`z-[60]\`, sheet \`z-[70]\`) zodat overlay en sluitknop **boven** de balk liggen — anders blijft de navbar zichtbaar “door” het open menu.

**Mobiel menu — start altijd gesloten:** Alpine-state voor hamburger/sheet/overlay **moet** op eerste paint **gesloten** zijn (bv. \`x-data="{ open: false }"\`, \`menuOpen: false\`, \`navOpen: false\`). **Nooit** \`open: true\` / \`menuOpen: true\` als default — bezoekers zien dan een volscherm-menu vóór ze tikken. Overlay/panel: \`x-show="open"\` (of \`:class\`) + eventueel \`x-cloak\` (de studio injecteert \`[x-cloak]{display:none!important}\` in preview/export) om flitsen te voorkomen. Op **brede** breakpoints (\`lg:\`+): horizontale links **zichtbaar** zonder eerst menu te openen.

**Leesbaarheid:** transparante of glass header over wisselende achtergronden: zorg **functioneel** voor contrast (bijv. \`:class\` op scroll, \`@scroll.window\`) — **geen** verplichte nav-stijl.

**Formulieren:** \`<form>\` met \`@submit.prevent\` mag voor UX (bijv. "bedankt"-toggle); echte server-POST is niet standaard — gebruik \`mailto:\`, \`tel:\`, \`https://\` of ankers naar \`#contact\` tenzij de briefing expliciet anders vraagt. Geen fictieve API-routes als harde afhankelijkheid.

${getStudioDefaultHeroVideoPromptBlock(opts?.defaultHeroVideoOrderSeed)}`;
}

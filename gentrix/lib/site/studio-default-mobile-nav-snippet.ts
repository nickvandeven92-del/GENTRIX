/**
 * Referentie-`<header>` voor Tailwind + Alpine (site-studio, one-pager).
 *
 * Live preview, `/site/…` en ZIP-export **injecteren automatisch** een vergelijkbaar menu wanneer de
 * HTML nog geen mobiel hamburger-patroon heeft — zie `lib/site/studio-auto-mobile-nav.ts`.
 * Dit bestand blijft het canonieke patroon voor prompts en handmatige aanpassing.
 *
 * Zet in de hero-sectie (of eerste sectie) en geef de pagina `padding-top` / `scroll-margin` i.v.m.
 * `fixed top-0` (bv. `body` class `pt-16` of `scroll-mt-24` op `#hero`).
 *
 * Patroon: één `x-data`, `navOpen: false` (ingeklapt tot tik), mobiele knop alleen onder `lg`
 * (streepjes ↔ × in **dezelfde** knop), backdrop + sheet met hogere `z-index` dan de balk,
 * `x-cloak`, Escape sluit.
 */
export const STUDIO_DEFAULT_ONEPAGE_HEADER_ALPINE_SNIPPET = `<header id="site-header" class="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-md" x-data="{ navOpen: false }" @keydown.escape.window="navOpen = false">
  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
    <a href="#top" class="shrink-0 text-lg font-semibold tracking-tight text-white">Jouw merk</a>
    <nav class="hidden items-center gap-8 text-sm font-medium text-white/90 lg:flex" aria-label="Hoofdmenu">
      <a href="#diensten" class="transition hover:text-white">Diensten</a>
      <a href="#werkwijze" class="transition hover:text-white">Werkwijze</a>
      <a href="#over-ons" class="transition hover:text-white">Over ons</a>
      <a href="#faq" class="transition hover:text-white">FAQ</a>
      <a href="__STUDIO_CONTACT_PATH__" class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/90">Contact</a>
    </nav>
    <button type="button" class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden" @click="navOpen = !navOpen" :aria-expanded="navOpen.toString()" aria-controls="site-mobile-sheet">
      <span class="sr-only">Menu</span>
      <span x-show="!navOpen" class="flex w-6 flex-col gap-1.5" aria-hidden="true">
        <span class="block h-0.5 rounded-full bg-white"></span>
        <span class="block h-0.5 rounded-full bg-white"></span>
        <span class="block h-0.5 rounded-full bg-white"></span>
      </span>
      <span x-show="navOpen" x-cloak class="text-2xl font-light leading-none text-white" aria-hidden="true">×</span>
    </button>
  </div>
  <div class="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm lg:hidden" x-show="navOpen" x-cloak @click="navOpen = false"></div>
  <div id="site-mobile-sheet" class="fixed inset-x-0 top-16 z-[70] max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-slate-950 px-4 py-6 shadow-2xl lg:hidden" x-show="navOpen" x-cloak>
    <nav class="flex flex-col gap-1 text-base font-medium text-white" aria-label="Mobiel menu">
      <a href="#diensten" class="rounded-lg px-3 py-3 hover:bg-white/5" @click="navOpen = false">Diensten</a>
      <a href="#werkwijze" class="rounded-lg px-3 py-3 hover:bg-white/5" @click="navOpen = false">Werkwijze</a>
      <a href="#over-ons" class="rounded-lg px-3 py-3 hover:bg-white/5" @click="navOpen = false">Over ons</a>
      <a href="#faq" class="rounded-lg px-3 py-3 hover:bg-white/5" @click="navOpen = false">FAQ</a>
      <a href="__STUDIO_CONTACT_PATH__" class="mt-2 rounded-full bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-white/90" @click="navOpen = false">Contact</a>
    </nav>
  </div>
</header>`;

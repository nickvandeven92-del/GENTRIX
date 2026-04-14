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
 * (drie gelijke streepjes gesloten, dun kruis uit twee lijnen open — **dezelfde** knop), backdrop + sheet
 * met hogere `z-index` dan de balk, `x-cloak`, Escape sluit.
 */
export const STUDIO_DEFAULT_ONEPAGE_HEADER_ALPINE_SNIPPET = `<header id="site-header" class="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/90 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md" x-data="{ navOpen: false }" @keydown.escape.window="navOpen = false">
  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
    <a href="#top" class="shrink-0 text-lg font-semibold tracking-tight text-white">Jouw merk</a>
    <nav class="hidden items-center gap-8 text-sm font-medium lg:flex" aria-label="Hoofdmenu">
      <a href="#diensten" class="text-white/90 transition-colors hover:text-white">Diensten</a>
      <a href="#werkwijze" class="text-white/90 transition-colors hover:text-white">Werkwijze</a>
      <a href="#over-ons" class="text-white/90 transition-colors hover:text-white">Over ons</a>
      <a href="#faq" class="text-white/90 transition-colors hover:text-white">FAQ</a>
      <a href="__STUDIO_CONTACT_PATH__" class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white/90">Contact</a>
    </nav>
    <button type="button" class="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ring-1 ring-white/15 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:hidden" @click="navOpen = !navOpen" :aria-expanded="navOpen.toString()" aria-controls="site-mobile-sheet">
      <span class="sr-only">Menu</span>
      <span class="relative block h-5 w-5 shrink-0" aria-hidden="true">
        <span x-show="!navOpen" x-transition.opacity.duration.150ms class="absolute inset-0 flex flex-col justify-center gap-[5px]">
          <span class="h-0.5 w-full rounded-full bg-white"></span>
          <span class="h-0.5 w-full rounded-full bg-white"></span>
          <span class="h-0.5 w-full rounded-full bg-white"></span>
        </span>
        <span x-show="navOpen" x-cloak x-transition.opacity.duration.150ms class="absolute inset-0 flex items-center justify-center">
          <span class="absolute h-0.5 w-5 rotate-45 rounded-full bg-white"></span>
          <span class="absolute h-0.5 w-5 -rotate-45 rounded-full bg-white"></span>
        </span>
      </span>
    </button>
  </div>
  <div class="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-md lg:hidden" x-show="navOpen" x-cloak @click="navOpen = false" aria-hidden="true"></div>
  <div id="site-mobile-sheet" class="fixed inset-x-0 top-16 z-[70] max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-4 pb-8 pt-5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10 lg:hidden" x-show="navOpen" x-cloak @click.stop>
    <nav class="flex flex-col gap-0.5" aria-label="Mobiel menu">
      <a href="#diensten" class="block w-full rounded-xl px-4 py-3.5 text-left text-[15px] font-medium tracking-tight text-white transition-colors hover:bg-white/10 active:bg-white/15" @click="navOpen = false">Diensten</a>
      <a href="#werkwijze" class="block w-full rounded-xl px-4 py-3.5 text-left text-[15px] font-medium tracking-tight text-white transition-colors hover:bg-white/10 active:bg-white/15" @click="navOpen = false">Werkwijze</a>
      <a href="#over-ons" class="block w-full rounded-xl px-4 py-3.5 text-left text-[15px] font-medium tracking-tight text-white transition-colors hover:bg-white/10 active:bg-white/15" @click="navOpen = false">Over ons</a>
      <a href="#faq" class="block w-full rounded-xl px-4 py-3.5 text-left text-[15px] font-medium tracking-tight text-white transition-colors hover:bg-white/10 active:bg-white/15" @click="navOpen = false">FAQ</a>
      <a href="__STUDIO_CONTACT_PATH__" class="mt-3 rounded-full bg-white px-4 py-3.5 text-center text-sm font-semibold text-slate-900 shadow-md transition hover:bg-white/95" @click="navOpen = false">Contact</a>
    </nav>
  </div>
</header>`;

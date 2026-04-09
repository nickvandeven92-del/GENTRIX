/**
 * Stille stock-loops (Pexels, direct .mp4). Gebruikt in AI-prompts als de klant een video-hero wil
 * zonder eigen URL — dan moet het model wél een echt `<video>` plaatsen (niet alleen CSS/SVG).
 *
 * URLs periodiek testen (HEAD); Pexels kan bestandsnamen wijzigen.
 */
export const STUDIO_DEFAULT_SILENT_HERO_MP4_URLS: readonly string[] = [
  "https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/3195392/3195392-hd_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/855564/855564-hd_1920_1080_24fps.mp4",
];

export function getStudioDefaultHeroVideoPromptBlock(): string {
  const list = STUDIO_DEFAULT_SILENT_HERO_MP4_URLS.map((u, i) => `${i + 1}. \`${u}\``).join("\n");
  return `=== STUDIO-VOORZIENE ACHTERGRONDVIDEO (geen eigen URL nodig) ===
Vraagt de gebruiker (of de briefing) om een **video-hero**, **bewegende achtergrond**, **achtergrondvideo**, **filmische loop**, **fullscreen video** of vergelijkbaar **zonder** een eigen videolink te leveren, dan **moet** je een **echt** \`<video>\` element gebruiken met **exact één** van onderstaande **https-MP4**-URL's (stille loop, Pexels). Kies wat het beste past bij sfeer/branche; abstract/donker B-roll is breed inzetbaar.

${list}

**Verplicht patroon** in de hero-sectie (\`#hero\` of eerste full-bleed hero):
- Buitenste wrapper: \`relative min-h-[72vh] md:min-h-[80vh] overflow-hidden bg-black\` (of de viewport-regels uit de hoofdprompt). **\`bg-black\`** vult het scherm vóór de eerste videoframe — voorkomt witte flits.
- **Laag 1 — video:** \`<video class="absolute inset-0 h-full w-full object-cover z-0" autoplay muted loop playsinline preload="auto">\` met daarbinnen \`<source src="[ÉÉN URL uit de lijst hierboven]" type="video/mp4">\`.
- **Poster (belangrijk):** laat \`poster\` **weglaten**, tenzij je een plaatje gebruikt dat **visueel hetzelfde** is als de video (zelfde scène). **Niet** een willekeurige **andere** Unsplash-foto als poster: bij bufferen of bij het **herstarten van de loop** toont de browser die poster kort — dan **knippert** een vreemde afbeelding door de video heen.
- **Laag 2 — overlay** voor leesbaarheid: \`absolute inset-0 z-10 bg-gradient-to-b from-black/70 via-black/50 to-black/85\` (intensiteit aanpassen aan thema).
- **Inhoud** (nav indien in hero, kop, CTA): \`relative z-20\`.

**Verboden bij “video hero”:** alleen een statische foto met belofte van “beweging”; CSS-only lasers/keyframes in \`<style>\` (wordt verwijderd); een leeg \`<video>\` zonder geldige \`source\`.

Levert de gebruiker **wél** een eigen **https-MP4** (bijv. geëxporteerd uit **Remotion**, Lovable, After Effects, of geüpload in de Studio-chat als bijlage-URL): gebruik die exacte URL als \`<source src="…" type="video/mp4">\` i.p.v. de studio-lijst. Geüploade video-URL's eindigen vaak op \`.mp4\` op de public storage-host — **muted + loop + playsinline** houden voor autoplay in browsers.`;
}

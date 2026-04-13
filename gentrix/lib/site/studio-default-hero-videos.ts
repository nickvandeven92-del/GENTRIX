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

function hashStringToUint32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministische PRNG voor Fisher–Yates (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    let t = (a = (a + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Herverdeelt de standaard-URL's op basis van een seed (zelfde seed → zelfde volgorde in de prompt).
 * Voorkomt dat modellen steeds de **eerste** URL in een vaste lijst kiezen.
 */
export function orderStudioDefaultHeroVideosForPrompt(orderSeed: string): string[] {
  const urls = [...STUDIO_DEFAULT_SILENT_HERO_MP4_URLS];
  const rng = mulberry32(hashStringToUint32(orderSeed));
  for (let i = urls.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = urls[i]!;
    urls[i] = urls[j]!;
    urls[j] = tmp;
  }
  return urls;
}

function randomUuidForSeed(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `seed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * @param orderSeed — optioneel; bijv. `varianceNonce` per site-generatie. Zonder seed: willekeurige permutatie per aanroep.
 */
export function getStudioDefaultHeroVideoPromptBlock(orderSeed?: string): string {
  const seed = orderSeed?.trim() || randomUuidForSeed();
  const ordered = orderStudioDefaultHeroVideosForPrompt(seed);
  const list = ordered.map((u, i) => `${i + 1}. \`${u}\``).join("\n");
  return `=== STUDIO-VOORZIENE ACHTERGRONDVIDEO (geen eigen URL nodig) ===
Vraagt de gebruiker (of de briefing) om een **video-hero**, **bewegende achtergrond**, **achtergrondvideo**, **filmische loop**, **fullscreen video** of vergelijkbaar **zonder** een eigen videolink te leveren, dan **moet** je een **echt** \`<video>\` element gebruiken met **exact één** van onderstaande **https-MP4**-URL's (stille loop, Pexels).

**Kies bewust — niet de eerste de beste:** de volgorde hieronder is **per generatie-run permutatie** (niet alfabetisch/vast). Modellen neigen tot de bovenste regel — dat is **fout** als een andere clip beter past. Vergelijk kort de sfeer (water/kust, stedelijk nacht, abstract donker B-roll) met briefing en branche en kies **één** URL die het beste aansluit. Gebruik **niet** telkens dezelfde standaard-clip als een andere uit deze lijst logischer is.

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

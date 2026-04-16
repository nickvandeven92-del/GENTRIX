/**
 * enhance-hero-section.ts
 *
 * Voegt subtiele achtergrondanimatie toe aan de hero — ALLEEN als de briefing
 * expliciete intentie-signalen bevat ("dynamisch", "levendig", etc.).
 *
 * Altijd subtiel: CSS orbs of zachte canvas golf. Nooit Three.js, nooit circus.
 *
 * Gebruik in generate-site-with-claude.ts, vóór finalizeBookingShopAfterAiGeneration:
 *
 *   import { maybeEnhanceHero } from "@/lib/ai/enhance-hero-section";
 *   data = { ...data, sections: maybeEnhanceHero(data.sections, data.config, description) };
 */

import type { MasterPromptPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";

// ─── Trigger trefwoorden ─────────────────────────────────────────────────────
// Bewust klein en specifiek — alleen als de gebruiker duidelijk animatie bedoelt.

const ANIMATION_KEYWORDS = [
  "dynamisch",
  "dynamische",
  "levendig",
  "levendige",
  "beweging",
  "bewegend",
  "bewegende",
  "geanimeerd",
  "animatie",
  "energiek",
  "energieke",
  "wow-effect",
  "wow effect",
  "animated",
  "animation",
] as const;

export function briefingWantsAnimation(briefing: string): boolean {
  const lower = briefing.toLowerCase();
  return ANIMATION_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Detectie helpers ────────────────────────────────────────────────────────

function isHeroSection(section: TailwindSection, index: number): boolean {
  const id = section.id.toLowerCase();
  return (
    id === "hero" ||
    id.startsWith("hero") ||
    id === "header" ||
    id === "banner" ||
    (index === 0 && (id.includes("intro") || id.includes("welcome")))
  );
}

function heroAlreadyAnimated(html: string): boolean {
  return (
    html.includes("requestAnimationFrame") ||
    html.includes("@keyframes") ||
    html.includes("<canvas") ||
    html.includes("animation:")
  );
}

// ─── Kleur uit theme ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return isNaN(r) ? "99,102,241" : `${r},${g},${b}`;
}

// ─── Subtiele animaties ──────────────────────────────────────────────────────

function buildSubtleOrbs(rgb: string): string {
  const id = `orb_${Math.random().toString(36).slice(2, 6)}`;
  return `<style>
#${id} { position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; }
#${id} .o { position:absolute; border-radius:50%; filter:blur(90px); animation:${id}_float 12s ease-in-out infinite; }
#${id} .o1 { width:45vw; height:45vw; background:rgb(${rgb}); opacity:0.12; top:-10%; left:-8%; animation-delay:0s; }
#${id} .o2 { width:30vw; height:30vw; background:rgb(${rgb}); opacity:0.08; bottom:-8%; right:-5%; animation-delay:-5s; }
@keyframes ${id}_float {
  0%,100% { transform:translate(0,0); }
  50%      { transform:translate(2vw,-3vh); }
}
</style>
<div id="${id}" aria-hidden="true">
  <div class="o o1"></div>
  <div class="o o2"></div>
</div>`;
}

function buildSubtleWave(rgb: string): string {
  return `<canvas data-hero-wave style="position:absolute;bottom:0;left:0;width:100%;height:120px;pointer-events:none;z-index:0;opacity:0.18;"></canvas>
<script>
(function(){
  var c=document.querySelector('[data-hero-wave]');
  if(!c)return;
  var ctx=c.getContext('2d');
  var phase=0;
  function resize(){ c.width=c.offsetWidth; c.height=120; }
  resize();
  window.addEventListener('resize',resize);
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    phase+=0.012;
    ctx.beginPath();
    ctx.moveTo(0,c.height);
    for(var x=0;x<=c.width;x+=4){
      var y=60+Math.sin(x*0.012+phase)*28+Math.sin(x*0.020+phase*0.7)*12;
      ctx.lineTo(x,y);
    }
    ctx.lineTo(c.width,c.height);
    ctx.closePath();
    ctx.fillStyle='rgba(${rgb},1)';
    ctx.fill();
    requestAnimationFrame(draw);
  }
  draw();
})();
</script>`;
}

// ─── Fade-up voor hero content ───────────────────────────────────────────────

function buildFadeUp(): string {
  return `<style>
@keyframes _hfu{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
[data-hero-content]>*:nth-child(1){animation:_hfu .7s ease both;}
[data-hero-content]>*:nth-child(2){animation:_hfu .7s .15s ease both;}
[data-hero-content]>*:nth-child(3){animation:_hfu .7s .30s ease both;}
[data-hero-content]>*:nth-child(4){animation:_hfu .7s .45s ease both;}
</style>`;
}

function injectContentAttr(html: string): string {
  return html.replace(/(<div[^>]*>)(\s*<(?:h1|h2))/, (match, div, after) => {
    if (div.includes("data-hero-content")) return match;
    return div.replace(">", ' data-hero-content="1">') + after;
  });
}

// ─── Kies animatiestijl op basis van theme ───────────────────────────────────

function pickStyle(config: MasterPromptPageConfig): "orbs" | "wave" {
  const bg = (config.theme?.background ?? "").toLowerCase();
  const style = (config.style ?? "").toLowerCase();

  if (
    bg.includes("#0") ||
    bg.includes("#1") ||
    bg.includes("#2") ||
    style.includes("dark") ||
    style.includes("donker")
  ) {
    return "orbs";
  }
  return "wave";
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export function enhanceHeroSection(
  sections: TailwindSection[],
  config: MasterPromptPageConfig,
): TailwindSection[] {
  const rgb = hexToRgb(config.theme?.primary ?? "#6366f1");
  const style = pickStyle(config);

  return sections.map((section, index) => {
    if (!isHeroSection(section, index)) return section;
    if (heroAlreadyAnimated(section.html)) return section;

    const animHtml = style === "orbs" ? buildSubtleOrbs(rgb) : buildSubtleWave(rgb);

    let html = section.html.replace(/(<section)([^>]*)(>)/, (_, tag, attrs, close) => {
      if (attrs.includes("relative")) return `${tag}${attrs}${close}`;
      if (attrs.includes('class="')) {
        return `${tag}${attrs.replace('class="', 'class="relative ')}${close}`;
      }
      return `${tag}${attrs} style="position:relative;"${close}`;
    });

    html = html.replace(/(<section[^>]*>)/, `$1\n${animHtml}\n`);
    html = buildFadeUp() + injectContentAttr(html);

    return { ...section, html };
  });
}

export function maybeEnhanceHero(
  sections: TailwindSection[],
  config: MasterPromptPageConfig,
  briefing: string,
): TailwindSection[] {
  if (!briefingWantsAnimation(briefing)) return sections;
  return enhanceHeroSection(sections, config);
}

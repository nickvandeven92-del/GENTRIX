/**
 * Detecteert creatieve multimedia / cinematische briefing en voegt harde eisen toe
 * zodat Claude geen standaard “feature-grid + kaarten” terugvalt.
 */

const CREATIVE_MULTIMEDIA_RE =
  /\b(multimedia|videoproductie|video\s*productie|videocontent|motion\s*graphics|post-?productie|broadcast|contentstudio|creatief\s*bureau|productiestudio|drone\s*beelden|animatiestudio|filmstudio|stock\s*footage|footage)\b/i;

const CINEMATIC_VISUAL_RE =
  /\b(video-?first|fullscreen|full-?bleed|cinemat|filmisch|cinematische\s+beleving|grote\s+beeldvlakken|groots?\s+beeld|beeldvlak|sfeerbeeld|immersive|showreel|\breel\b|documentaire|productiefilm|merkfilm|bewegende\s+beelden|bewegend\s+beeld|moving\s+images)\b/i;

/** Fysieke leisure-bestemmingen: eigen modus met **verplichte** hero-video (één paginavideo = PREMIUM). */
const IMMERSIVE_DESTINATION_RE =
  /\b(waterpretpark|waterpark|aquapark|zwemparadijs|zwemparadijzen|pretpark|themapark|attractiepark|avonturenpark|belevingspark|dierenpark|safaripark|safari\s*park|vakantiepark|familiepark|speelparadijs|indoor\s*pretpark|strandresort|ski-?resort|glamping|resort|zwembadcomplex)\b/i;

export function isImmersiveDestinationBriefing(description: string): boolean {
  const t = description.trim();
  if (!t) return false;
  return IMMERSIVE_DESTINATION_RE.test(t);
}

export function isCinematicMultimediaBriefing(description: string): boolean {
  const t = description.trim();
  if (!t) return false;
  return (
    CREATIVE_MULTIMEDIA_RE.test(t) ||
    CINEMATIC_VISUAL_RE.test(t) ||
    IMMERSIVE_DESTINATION_RE.test(t)
  );
}

function buildHeroRequirementParagraph(mandatoryVideo: boolean): string {
  if (mandatoryVideo) {
    return `1. **Hero (eerste sectie \`hero\`) — IMMERSIVE DESTINATION:** **Verplicht** een **stille achtergrond-loopvideo** over minimaal **~60–100vh** — \`relative overflow-hidden\` met achtergrondlaag. Dit is **de enige** \`<video autoplay loop>\` op de pagina (PREMIUM telt dit als “max. één video” — **geen** optionele keuze “foto i.p.v. video”):
   - \`<video class="absolute inset-0 h-full w-full object-cover" muted playsinline autoplay loop preload="metadata" poster="https://images.unsplash.com/…">\` met een **werkende** MP4-URL op \`https://\` (bijv. \`videos.pexels.com\`), **én** een \`poster\` (Unsplash \`photo-\` id). **Verboden:** hero zonder video in deze modus; geen tweede autoplay-video elders; geen slap effen vlak zonder bewegend beeld.`;
  }
  return `1. **Hero (eerste sectie \`hero\`):** Dominant **beeld of video** over minimaal **~60–100vh** — \`relative overflow-hidden\` met een **achtergrondlaag**:
   - Voorkeur: \`<video class="absolute inset-0 h-full w-full object-cover" muted playsinline autoplay loop preload="metadata" poster="https://images.unsplash.com/…">\` met een **werkende** MP4-URL op \`https://\` (bijv. \`videos.pexels.com\` of vergelijkbaar stock), **én** een \`poster\` (Unsplash \`photo-\` id) voor eerste frame; **of** alleen een sterk full-bleed Unsplash-beeld met donkere lees-overlay — **niet** een effen kleurvlak zonder media.`;
}

export function buildCinematicMultimediaPromptBlock(description: string): string {
  if (!isCinematicMultimediaBriefing(description)) return "";

  const immersive = isImmersiveDestinationBriefing(description);
  const headline = immersive
    ? `=== 0C. CINEMATISCH / IMMERSIVE BESTEMMING (automatisch — gaat boven generieke marketing-layouts + PREMIUM “optionele” video) ===

De briefing hoort bij **film, beeld, multimedia** en/of een **fysieke leisure-bestemming**. Dit is **geen** SaaS-template en **geen** stapel losse witte secties — denk **één doorlopend canvas** (Lovable): gedeelde tint, doorlopende beeldtaal, variatie in ritme — **niet** vijf identieke “blokken met randjes”.`
    : `=== 0C. CINEMATISCHE MULTIMEDIA (automatisch gedetecteerd — gaat boven generieke marketing-layouts) ===

De briefing hoort bij **film / beeld / multimedia**. Dit is **geen** SaaS- of lokale-dienst-template. **Eén samenhangende pagina:** doorlopende scroll en visuele aders — vermijd de indruk van los gestapelde template-secties.`;

  const heroPara = buildHeroRequirementParagraph(immersive);

  return `${headline}

**Verplicht (anders is de output ongeldig t.o.v. de opdracht):**
${heroPara}
2. **Geen “features”-psychologie:** Geen sectie die bestaat uit **drie of vier gelijke kolommen** met icoon + titel + korte USP in kadertjes. Geen rij “waarden” met gekleurde vierkantjes.
3. **Sectie \`portfolio\`:** alleen invullen als \`portfolio\` **daadwerkelijk** in \`_site_config.sections\` staat (die id wordt alleen gepland bij expliciete multimedia-/showreel-briefing). Dan: **breed formaat** (16:9 / 21:9), full-bleed strip, horizontale scroll of editorial collage — minstens **twee** verschillende Unsplash-stills met echte \`photo-\` id’s. Staat \`portfolio\` **niet** in die lijst: geen aparte portfoliosectie maken.
4. **Sectie \`story\` / \`about\`:** Korte, strakke copy; liefst **één** sterke kolom of split met **groot** beeld — geen opsomming van “diensten als productfeatures”.
5. **CTA:** Aanwezig maar ingetogen (outline of kleine tekstlink), geen schreeuwerige deal-knoppen.
6. **Nav (cinematic):** Logo + links **in** de hero, bovenop video/beeld — gebruik \`fixed top-0 inset-x-0 z-50\` **of** \`sticky top-0 z-50\` met **transparante donkere** glasstrook (zelfde tokens als \`navigation.wrapper\` waar mogelijk) zodat de balk **bij scroll zichtbaar blijft** — **verboden:** losse vol-breedte \`bg-white\` header **boven** een donkere fullscreen hero (dat oogt als mislukte template, niet als Lovable/cinematic).

**Verboden:** testimonials, prijstabellen, FAQ en “trust badges” **tenzij** de gebruikersbriefing die expliciet vraagt.`;
}

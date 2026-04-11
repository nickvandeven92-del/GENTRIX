/**
 * Tweede LLM-pass na eerste generatie: “eigen kwaliteitscontrole” op basis van briefing,
 * gejoinde HTML en programmatische checks (validate + claim diagnostics).
 * Geen echte screenshot/vision — het model “ziet” de pagina via structuur + markup (zoals Lovable-interne review).
 *
 * **Wat doet dit?** Een tweede Claude-call leest je concept-JSON en mag vooral `html` bijschaven:
 * betere contrasten, dubbele navigatie weg, laser-decoratie alleen als de briefing dat rechtvaardigt,
 * kortere dubbele trust-blokken, hero wat vullen als die te kaal is — zonder secties te verwijderen of `id`’s te wijzigen.
 *
 * **Standaard uit:** geen tweede LLM-pass (voorkomt timeouts); expliciet aanzetten met env (zie hieronder).
 * **Aanzetten:** `ENABLE_SITE_SELF_REVIEW=1` / `true` / `yes` in `.env.local`.
 * **Force uit:** `DISABLE_SITE_SELF_REVIEW=1` wint altijd (ook als ENABLE gezet is).
 * Na wijziging: dev-server herstarten.
 *
 * **Trade-off:** coherente revisie — **niet** bedoeld om output **saver of generischer** te maken dan de briefing vraagt.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import type { HomepagePlan } from "@/lib/ai/validate-generated-page";
import { buildContentAuthorityPolicyBlock } from "@/lib/ai/content-authority-policy";
import {
  buildContentClaimDiagnosticsReport,
  type ContentClaimDiagnosticsReport,
} from "@/lib/ai/content-claim-diagnostics";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import {
  ensureClaudeMarketingSiteJsonHasContactSections,
  normalizeClaudeSectionArraysInParsedJson,
  postProcessClaudeTailwindMarketingSite,
  postProcessClaudeTailwindPage,
} from "@/lib/ai/generate-site-postprocess";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import {
  claudeTailwindMarketingSiteOutputSchema,
  claudeTailwindPageOutputSchema,
  mapClaudeMarketingSiteOutputToSections,
  mapClaudeOutputToSections,
  slugifyToSectionId,
  type ClaudeTailwindMarketingSiteOutput,
  type ClaudeTailwindPageOutput,
  type GeneratedTailwindPage,
} from "@/lib/ai/tailwind-sections-schema";
import { validateMarketingSiteHardRules } from "@/lib/ai/validate-marketing-site-output";
import { validateGeneratedPageHtml } from "@/lib/ai/validate-generated-page";
import {
  formatReferenceVisualAxesForPrompt,
  type DesignGenerationContract,
} from "@/lib/ai/design-generation-contract";
import type { GenerationPipelineFeedback, StyleDetectionSource } from "@/lib/ai/generate-site-with-claude";

const MAX_DRAFT_JSON_CHARS = 380_000;

const SELF_REVIEW_SYSTEM = `Je bent senior QA en front-end reviser voor Tailwind-marketing sites als **JSON**: \`config\` + \`sections\` (landing), **optioneel** \`marketingPages\` (object met subpagina-keys → sectie-arrays), en **indien het concept \`contactSections\` heeft** ook die array (contactpagina met formulier).

Je krijgt de briefing, een **concept**-JSON, en **automatische checks** (validator + claim-scan). Behandel de markup alsof je de pagina visueel doorloopt: hiërarchie, hero-impact, redundante trust-blokken, generieke kaartenmuur, verticale lengte, en vooral **feitelijke integriteit**.

=== OUTPUT ===
- Antwoord met **alleen** één geldig JSON-object (geen markdown-fences, geen toelichting buiten JSON).
- Vorm: **zelfde top-level keys als het concept** (sectie-arrays + optioneel \`marketingPages\`). Geen keys weglaten die het concept wél had.
- Houd **hetzelfde aantal secties** in elke array en **dezelfde sectie-\`id\`’s in dezelfde volgorde** als het concept. Alleen \`html\` (en zo nodig \`name\`) inhoudelijk verbeteren; \`config\` alleen bij kleine correctie als die duidelijk botst met de briefing (kleur/font), niet opnieuw ontwerpen.
- **Multi-pagina:** landing zonder \`<form>\`; subpagina's in \`marketingPages\` zonder \`<form>\`; contact met formulier; cross-route via \`__STUDIO_SITE_BASE__/…\` en \`__STUDIO_CONTACT_PATH__\`; **geen** \`href="#"\`.

=== INHOUD (strikt) ===
${buildContentAuthorityPolicyBlock()}

=== VISUEEL / UX ===
- **Strakker ≠ saver:** vermijd revisies die vooral "veiliger", grijzer of **anoniemer** maken **zonder** validator-, claim- of briefing-reden. Een **distinctief** concept (sterk palet, editorial layout, duidelijke niche) mag **niet** worden afgevlakt naar standaard drie-kaarten tenzij dat een echte fout herstelt.
- Ontbrekende \`<h1>\`, kapotte interne \`href="#…"\`, identieke canonieke \`/site/…\` of \`https://…/site/…\` **zonder** passend \`#\` op meerdere menu-items, of zichtbare placeholder-copy: **repareren** (zet interne navigatie op \`#<sectie-id>\` die in de markup bestaat).
- Verminder **onnodige lengte** binnen secties: dubbele stats/testimonial/CTA-banen samenvatten of één rustig blok maken **zonder** secties te droppen.
- Behoud \`data-animation\` en root-\`id\` op sectie waar geldig. Marquee: \`studio-marquee\` / \`studio-marquee-track\` alleen met dubbele set items (anders hapert de loop). **\`studio-border-reveal\`:** behoud bestaande \`studio-border-reveal--h\` / \`--v\` waar ze kloppen; als de briefing **rand/border/kader/scroll-lijn** vraagt en er staan **minder dan 3** reveals op de landing → voeg lege \`<div class="… studio-border-reveal studio-border-reveal--h …">\` toe onder koppen of tussen blokken (met passende \`[--studio-br-rgb:…]\` als het palet dat vraagt). **Laser:** als \`studio-laser-*\` staat zonder duidelijke cyber/neon/sci-fi-wens → **verwijder**; liever border-reveal + marquee. Als wél passend: max. één rail in hero; \`relative\` parent.
- Als de briefing **motion-signalen** bevat (interactief, dynamisch, animatie(s), motion, micro-interactions/micro-interacties, scroll-animaties, in beweging, bewegende UI, levend/levendige site, niet te statisch, veel visuele dynamiek — NL of EN) en het concept **weinig of geen** \`data-animation\` heeft: voeg \`data-animation\` toe op minstens **10** zichtbare elementen (koppen, kaarten, grotere blokken) — voorkeur \`fade-up\` — **zonder** sectie-\`id\` of volgorde te wijzigen.
- Sterkere typografie/contrast als het concept botst met de **briefing** (bijv. gevraagd warm/donker maar alles koud wit; of gevraagd **licht/helder/crème** maar de pagina is overwegend near-black zonder dat de briefing dat zo vraagt) — binnen Tailwind-utilities.
- **Hero heel kaal (effen donker zonder enige visuele laag):** alleen bijsturen als dat duidelijk zwak oogt **en** de briefing geen expliciet minimalisme vraagt — voeg desgewenst foto, gradient of textuur toe.
- **Header/menu met structureel slecht contrast** (bijv. lichte linktekst op lichte secties, of donkere links op donkere achtergrond): repareer met eenvoudige Tailwind- of Alpine-aanpassingen.
- **Hero zonder redelijke \`min-h-*\` op het buitenste blok:** kan een smalle strook + leeg wit in de preview geven — overweeg \`min-h-[72vh] md:min-h-[80vh]\` (of vergelijkbaar) tenzij de briefing anders wil.
- Als **PIPELINE-DETECTIE** in het user-bericht staat: het concept moet die **stijl (id)** en **branche** redelijk volgen; verbeter knal-contrast of verkeerde sfeer zodat het bij de gedetecteerde intent past (tenzij de briefing expliciet iets anders eist).
- Als **DESIGN-AFSPRAAK (Denklijn-contract)** in het user-bericht staat: dat is **dezelfde run** als de Denklijn — herstel hero-beelden, dominante stock, thema (\`config.theme\`) en motion zodat ze **duidelijk** binnen dat contract vallen. Bij **expliciete** briefing-tegenstrijdigheid wint de briefing; vermeld dat niet in JSON, pas alleen markup/config aan.
- Als het designcontract-blok **REFERENCE VISUAL AXES** (\`referenceVisualAxes\`) bevat: controleer **as-per-as** of de markup die assen echt volgt — niet alleen woorden uit het excerpt. \`layoutRhythm\` → grid/whitespace/max-width; \`themeMode\` + \`paletteIntent\` → \`config.theme\` + achtergrond/contrast; \`typographyDirection\` → \`config.font\` + heading/body-gewicht; \`heroComposition\` → hero-layout (split/stack/overlay); \`sectionDensity\` → verticale padding en sectielengte; \`motionStyle\` → \`data-animation\` / marquee / statisch; \`borderTreatment\` → \`studio-border-reveal\` / hairlines / zware kaders; \`cardStyle\` → schaduw/rand/glas-achtige kaarten. Bij conflict: briefing op **inhoud/claims/CTA**; assen op **visuele schil** tenzij de briefing iets visueels expliciet verbiedt.
- Als **REFERENTIESITE EXCERPT** in het user-bericht staat **zonder** \`referenceVisualAxes\`: stem visueel af op excerpt + briefing zoals bij pass 1; als wél assen aanwezig: gebruik assen als **checklijst**.
- **Stijlincoherentie:** als de pagina **twee botsende** esthetieken tegelijk als hoofdbeeld toont (bv. zware neumorphism + harde brutalism, of vol skeuomorphism + vol flat zonder briefing-reden), **vereenvoudig** naar **één** duidelijke richting die bij de gedetecteerde primaire stijl of de briefing past.
- **Dubbele navigatie:** als dezelfde site-menu-items **twee keer** prominent staan (topbar + verticale/zij-nav met identieke \`#…\` links), **snoei** tot **één** globale nav (behoud de sterkste; verwijder de dubbele lijst).
- **Mobiel menu standaard “aan”:** als een hamburger/sheet/overlay **zonder gebruikersactie** al open staat (Alpine \`open: true\` / \`menuOpen: true\` of panel zonder \`x-show\`/\`hidden\`), zet de **startwaarde op false** en verberg het panel tot toggle — desktop: links op \`lg:\`+ gewoon zichtbaar.
- **Typografie door elkaar:** footer/body in **Times-achtige** serif terwijl koppen brutal/cyber **sans** zijn — **trek recht**: één familie voor body + UI, of bewust **één** gepaarde serif alleen voor koppen **met** passende \`config.font\`; verhoog body-contrast op donker (\`text-gray-200\`+, geen \`font-light\` + \`text-gray-500\` op zwart).
- **Hero te druk t.o.v. briefing:** als de eerste sectie vol staat met tekst en knoppen terwijl de klant rust/luxe vraagt, **vereenvoudig** (kortere kop, minder knoppen, uitleg naar volgende sectie) — geen verplichte serif/knoppen-formule; hero zonder knoppen is prima tenzij de briefing anders vraagt.
- Vraagt de briefing **vintage / warm papier / old-school**: breng diensten-, trust- en testimonial-secties visueel in **dezelfde warme papierwereld** (crème/zand/stone-warm sectie-achtergronden); vervang dominerend \`bg-white\` op brede banden door passende warme tinten; geen willekeurige off-topic full-bleed beelden (bijv. verf/klus) tenzij de briefing dat zo noemt.`;

/**
 * Tweede LLM-pass staat **standaard uit** (minder stream-timeouts).
 * Aanzetten: `ENABLE_SITE_SELF_REVIEW=1` / `true` / `yes`.
 * Uitzetten wint altijd: `DISABLE_SITE_SELF_REVIEW=1`.
 */
export function isSiteSelfReviewEnabled(): boolean {
  if (process.env.DISABLE_SITE_SELF_REVIEW === "1") return false;
  const v = process.env.ENABLE_SITE_SELF_REVIEW?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function generatedTailwindPageToClaudeOutput(
  page: GeneratedTailwindPage,
): ClaudeTailwindPageOutput | ClaudeTailwindMarketingSiteOutput {
  const sectionRows = page.sections.map((s, i) => ({
    id: s.id?.trim() ? s.id.trim() : slugifyToSectionId(s.sectionName, i),
    html: s.html,
    name: s.sectionName,
  }));
  if (page.contactSections != null && page.contactSections.length > 0) {
    const row = (s: (typeof page.sections)[number], i: number) => ({
      id: s.id?.trim() ? s.id.trim() : slugifyToSectionId(s.sectionName, i),
      html: s.html,
      name: s.sectionName,
    });
    const base: ClaudeTailwindMarketingSiteOutput = {
      config: page.config,
      sections: sectionRows,
      contactSections: page.contactSections.map(row),
    };
    if (page.marketingPages != null && Object.keys(page.marketingPages).length > 0) {
      return {
        ...base,
        marketingPages: Object.fromEntries(
          Object.entries(page.marketingPages).map(([k, secs]) => [k, secs.map(row)]),
        ),
      };
    }
    return base;
  }
  return {
    config: page.config,
    sections: sectionRows,
  };
}

function styleSourceNl(source: StyleDetectionSource | undefined): string {
  if (source === "explicit_stijl_line") {
    return "expliciete regel in briefing (Stijl / Style …)";
  }
  if (source === "keyword_match") {
    return "trefwoorden in briefing (automatische match)";
  }
  if (source === "none") {
    return "geen stijlprofiel — eerste pass had creatieve vrijheid";
  }
  return "onbekend";
}

const REFERENCE_EXCERPT_SELF_REVIEW_MAX = 6_000;

function buildReferenceExcerptBlockForSelfReview(snap: { url: string; excerpt: string } | undefined): string {
  if (!snap?.excerpt?.trim()) return "";
  const excerpt = snap.excerpt.trim().slice(0, REFERENCE_EXCERPT_SELF_REVIEW_MAX);
  return `=== REFERENTIESITE EXCERPT (zelfde run als pass 1) ===
URL: ${snap.url}

HTML-fragment (alleen voor visuele afstemming; geen lange teksten of merknamen van derden letterlijk overnemen):
${excerpt}

Als het concept **duidelijk** afwijkt van deze referentie (ander licht/donker-spoor, totaal andere hero-sfeer) zonder dat de briefing dat eist: **trek** binnen dezelfde sectie-\`id\`'s richting dit excerpt.

`;
}

function formatDesignContractForReview(c: DesignGenerationContract): string {
  const avoid = c.imageryAvoid?.length ? c.imageryAvoid.join(", ") : "(—)";
  const axes = c.referenceVisualAxes;
  const axesSection = axes
    ? [
        "",
        "**REFERENCE VISUAL AXES (checklijst — visueel leidend naast briefing):**",
        formatReferenceVisualAxesForPrompt(axes),
      ].join("\n")
    : "";
  return [
    `- **Hero-visueel:** ${c.heroVisualSubject}`,
    ...(c.heroImageSearchHints ? [`- **Foto-zoekhints:** ${c.heroImageSearchHints}`] : []),
    `- **Palett-modus:** ${c.paletteMode}${c.primaryPaletteNotes ? ` — ${c.primaryPaletteNotes}` : ""}`,
    `- **Beeld MUST:** ${c.imageryMustReflect.join(", ")}`,
    `- **Beeld vermijden:** ${avoid}`,
    `- **Motion (motionLevel):** ${c.motionLevel}`,
    ...(c.toneSummary ? [`- **Toon:** ${c.toneSummary}`] : []),
    axesSection,
  ].join("\n");
}

function buildSelfReviewUserPrompt(params: {
  businessName: string;
  description: string;
  draft: ClaudeTailwindPageOutput | ClaudeTailwindMarketingSiteOutput;
  validation: ReturnType<typeof validateGeneratedPageHtml>;
  claims: ContentClaimDiagnosticsReport;
  /** Zelfde detectie als pass 1 — zodat revisie weet welke designtaal bedoeld was. */
  pipelineInterpreted?: GenerationPipelineFeedback["interpreted"];
  /** Zelfde run als Denklijn — afstemming hero/thema/motion. */
  designContract?: DesignGenerationContract | null;
  /** Zelfde excerpt als in bouw-prompt (alleen bij geslaagde referentie-fetch). */
  referenceSiteSnapshot?: { url: string; excerpt: string };
}): string {
  const draftJson = JSON.stringify(params.draft);
  const claimLines =
    params.claims.items.length === 0
      ? "(Geen claim-waarschuwingen.)"
      : params.claims.items
          .slice(0, 24)
          .map((c) => `- [${c.severity}] ${c.code}: "${c.match}"`)
          .join("\n");

  const err =
    params.validation.errors.length === 0
      ? "(Geen validator-fouten.)"
      : params.validation.errors.map((e) => `- ERROR: ${e}`).join("\n");
  const warn =
    params.validation.warnings.length === 0
      ? "(Geen validator-waarschuwingen.)"
      : params.validation.warnings.map((w) => `- WARN: ${w}`).join("\n");

  const referenceBlock = buildReferenceExcerptBlockForSelfReview(params.referenceSiteSnapshot);

  const dc = params.designContract;
  const designContractBlock = dc
    ? `=== DESIGN-AFSPRAAK (Denklijn-contract, zelfde run) ===
De eerste generatie is uitgevoerd **nadat** dit contract aan de bouw-prompt was toegevoegd. Controleer of het concept hier nog duidelijk van afwijkt (hero, stock, palet, motion) en **corrigeer** binnen dezelfde sectie-\`id\`'s.

${formatDesignContractForReview(dc)}

`
    : "";

  const pi = params.pipelineInterpreted;
  const pipelineBlock = pi
    ? `=== PIPELINE-DETECTIE (pass 1 — intent voor revisie) ===
Dit is **niet** een tweede meningsvorming: de eerste generatie is gebouwd met deze **gedetecteerde** branche- en stijlkeuze uit dezelfde briefing. Het HTML-concept hoort daarbij aan te sluiten.

- **Branche (label):** ${pi.detectedIndustry ?? "(niet gedetecteerd)"}
- **Branche (id):** ${pi.detectedIndustryId ?? "—"}
- **Stijl (label):** ${pi.detectedStyle ?? "(geen stijlprofiel)"}
- **Stijl (id):** ${pi.detectedStyleId ?? "—"}
- **Stijl-bron:** ${styleSourceNl(pi.styleDetectionSource)}
${pi.referenceStyle ? `- **Referentiesite:** ${pi.referenceStyle.requestedUrl} — ${pi.referenceStyle.status === "ingested" ? `ingelezen (${pi.referenceStyle.excerptChars ?? "?"} tekens, final: ${pi.referenceStyle.finalUrl ?? "—"})` : `ophalen mislukt: ${pi.referenceStyle.error ?? "onbekend"}`}` : ""}
- **Kwaliteit:** trek het concept **niet** terug naar timide/generiek tenzij dat nodig is voor echte fouten, claims of briefing-schendingen.
Als de markup **duidelijk** afwijkt van deze stijl (bijv. luxe flyer i.p.v. industrieel, of omgekeerd), **corrigeer** dan binnen dezelfde sectie-\`id\`'s en JSON-structuur. Bij twijfel: briefing + dit blok samen lezen.

`
    : "";

  return `=== BEDRIJF ===
${params.businessName.trim()}

=== BRIEFING ===
${params.description.trim()}

${referenceBlock}${designContractBlock}${pipelineBlock}

=== AUTOMATISCHE CHECKS (validator) ===
Fouten:
${err}

Waarschuwingen:
${warn}

=== CLAIM-SCAN (samenvatting) ===
Errors: ${params.claims.errorCount}, warns: ${params.claims.warnCount}
${claimLines}

=== CONCEPT JSON (revisiebasis; retourneer volledige verbeterde variant) ===
${draftJson}`;
}

/**
 * Voert desgewenst tweede non-stream call uit. Bij parse-fout of oversize draft: retourneert \`draft\` ongewijzigd.
 */
export async function applySelfReviewToGeneratedPage(options: {
  client: Anthropic;
  model: string;
  businessName: string;
  description: string;
  draft: GeneratedTailwindPage;
  homepagePlan: HomepagePlan;
  preserveLayoutUpgrade: boolean;
  /** Zelfde \`interpreted\` als \`generation_meta\` — voor consistente revisie. */
  pipelineInterpreted?: GenerationPipelineFeedback["interpreted"];
  /** Optioneel: Denklijn-contract uit dezelfde run (idee 3). */
  designContract?: DesignGenerationContract | null;
  /** Zelfde excerpt als pass 1 wanneer referentie-URL is ingelezen. */
  referenceSiteSnapshot?: { url: string; excerpt: string };
}): Promise<{ data: GeneratedTailwindPage; ran: boolean; usedRefined: boolean }> {
  const {
    client,
    model,
    businessName,
    description,
    draft,
    homepagePlan,
    preserveLayoutUpgrade,
    pipelineInterpreted,
    designContract,
    referenceSiteSnapshot,
  } = options;

  if (!isSiteSelfReviewEnabled() || preserveLayoutUpgrade) {
    return { data: draft, ran: false, usedRefined: false };
  }

  const claudeDraft = generatedTailwindPageToClaudeOutput(draft);
  const draftStr = JSON.stringify(claudeDraft);
  if (draftStr.length > MAX_DRAFT_JSON_CHARS) {
    console.warn(
      `[self-review] overgeslagen: concept-JSON te groot (${draftStr.length} > ${MAX_DRAFT_JSON_CHARS} tekens).`,
    );
    return { data: draft, ran: false, usedRefined: false };
  }

  const joined = draft.sections.map((s) => s.html).join("\n");
  const validation = validateGeneratedPageHtml(joined, homepagePlan);
  const contactJoined =
    draft.contactSections != null && draft.contactSections.length > 0
      ? draft.contactSections.map((s) => s.html).join("\n")
      : "";
  const marketingJoined =
    draft.marketingPages != null
      ? Object.values(draft.marketingPages)
          .flat()
          .map((s) => s.html)
          .join("\n")
      : "";
  const claims =
    draft.contentClaimDiagnostics ??
    buildContentClaimDiagnosticsReport(
      joined + (contactJoined ? `\n${contactJoined}` : "") + (marketingJoined ? `\n${marketingJoined}` : ""),
    );

  const user = buildSelfReviewUserPrompt({
    businessName,
    description,
    draft: claudeDraft,
    validation,
    claims,
    pipelineInterpreted,
    designContract: options.designContract,
    referenceSiteSnapshot: options.referenceSiteSnapshot,
  });

  let textBody = "";
  try {
    const message = await client.messages.create({
      model,
      max_tokens: clampMaxTokensNonStreaming(model, 24_576),
      system: SELF_REVIEW_SYSTEM,
      messages: [{ role: "user", content: user }],
    });

    await logClaudeMessageUsage("generate_site_self_review", model, message.usage);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.warn("[self-review] geen tekstblok; concept behouden.");
      return { data: draft, ran: true, usedRefined: false };
    }
    textBody = textBlock.text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[self-review] API-fout; concept behouden:", msg);
    return { data: draft, ran: true, usedRefined: false };
  }

  const parsedResult = parseModelJsonObject(textBody);
  if (!parsedResult.ok) {
    console.warn("[self-review] geen geldige JSON; concept behouden.");
    return { data: draft, ran: true, usedRefined: false };
  }

  const marketingMulti = draft.contactSections != null && draft.contactSections.length > 0;

  if (marketingMulti) {
    const validated = claudeTailwindMarketingSiteOutputSchema.safeParse(
      ensureClaudeMarketingSiteJsonHasContactSections(
        normalizeClaudeSectionArraysInParsedJson(parsedResult.value),
      ),
    );
    if (!validated.success) {
      console.warn("[self-review] schema mismatch; concept behouden:", validated.error.message);
      return { data: draft, ran: true, usedRefined: false };
    }
    const processed = postProcessClaudeTailwindMarketingSite(validated.data);
    const mapped = mapClaudeMarketingSiteOutputToSections(processed);
    if (
      mapped.sections.length !== draft.sections.length ||
      mapped.contactSections.length !== draft.contactSections!.length
    ) {
      console.warn("[self-review] sectie-aantal gewijzigd (multi-page); concept behouden.");
      return { data: draft, ran: true, usedRefined: false };
    }
    for (let i = 0; i < draft.sections.length; i++) {
      if (mapped.sections[i]?.id !== draft.sections[i]?.id) {
        console.warn(`[self-review] landings-sectie-id op index ${i} afwijkend; concept behouden.`);
        return { data: draft, ran: true, usedRefined: false };
      }
    }
    for (let i = 0; i < draft.contactSections!.length; i++) {
      if (mapped.contactSections[i]?.id !== draft.contactSections![i]?.id) {
        console.warn(`[self-review] contact-sectie-id op index ${i} afwijkend; concept behouden.`);
        return { data: draft, ran: true, usedRefined: false };
      }
    }
    if (draft.marketingPages != null && Object.keys(draft.marketingPages).length > 0) {
      const dMp = draft.marketingPages;
      const mMp = mapped.marketingPages;
      if (mMp == null) {
        console.warn("[self-review] marketingPages ontbreken na revisie; concept behouden.");
        return { data: draft, ran: true, usedRefined: false };
      }
      const dKeys = Object.keys(dMp).sort().join("\0");
      const mKeys = Object.keys(mMp).sort().join("\0");
      if (dKeys !== mKeys) {
        console.warn("[self-review] marketingPages-keys gewijzigd; concept behouden.");
        return { data: draft, ran: true, usedRefined: false };
      }
      for (const k of Object.keys(dMp)) {
        const a = dMp[k]!;
        const b = mMp[k]!;
        if (a.length !== b.length) {
          console.warn(`[self-review] marketingPages["${k}"] aantal secties gewijzigd; concept behouden.`);
          return { data: draft, ran: true, usedRefined: false };
        }
        for (let i = 0; i < a.length; i++) {
          if (b[i]?.id !== a[i]?.id) {
            console.warn(`[self-review] marketingPages["${k}"] id op index ${i} afwijkend; concept behouden.`);
            return { data: draft, ran: true, usedRefined: false };
          }
        }
      }
    }
    const rules = validateMarketingSiteHardRules(mapped.sections, mapped.contactSections, mapped.marketingPages);
    if (rules.length > 0) {
      console.warn("[self-review] harde marketing-regels geschonden na revisie; concept behouden:", rules.join(" "));
      return { data: draft, ran: true, usedRefined: false };
    }
    const refined: GeneratedTailwindPage = {
      config: mapped.config,
      sections: mapped.sections,
      contactSections: mapped.contactSections,
      ...(mapped.marketingPages != null && Object.keys(mapped.marketingPages).length > 0
        ? { marketingPages: mapped.marketingPages }
        : {}),
      ...(draft.logoSet != null ? { logoSet: draft.logoSet } : {}),
    };
    const contactSecs = refined.contactSections ?? [];
    const marketingSecs = refined.marketingPages != null ? Object.values(refined.marketingPages).flat() : [];
    const htmlJoined = [...refined.sections, ...contactSecs, ...marketingSecs].map((s) => s.html).join("\n");
    return {
      data: {
        ...refined,
        contentClaimDiagnostics: buildContentClaimDiagnosticsReport(htmlJoined),
      },
      ran: true,
      usedRefined: true,
    };
  }

  const validated = claudeTailwindPageOutputSchema.safeParse(
    normalizeClaudeSectionArraysInParsedJson(parsedResult.value),
  );
  if (!validated.success) {
    console.warn("[self-review] schema mismatch; concept behouden:", validated.error.message);
    return { data: draft, ran: true, usedRefined: false };
  }

  const processed = postProcessClaudeTailwindPage(validated.data);
  const mapped = mapClaudeOutputToSections(processed);

  if (mapped.sections.length !== draft.sections.length) {
    console.warn(
      `[self-review] sectie-aantal gewijzigd (${mapped.sections.length} vs ${draft.sections.length}); concept behouden.`,
    );
    return { data: draft, ran: true, usedRefined: false };
  }

  for (let i = 0; i < draft.sections.length; i++) {
    if (mapped.sections[i]?.id !== draft.sections[i]?.id) {
      console.warn(`[self-review] sectie-id op index ${i} afwijkend; concept behouden.`);
      return { data: draft, ran: true, usedRefined: false };
    }
  }

  const refined: GeneratedTailwindPage = {
    config: mapped.config,
    sections: mapped.sections,
    ...(draft.logoSet != null ? { logoSet: draft.logoSet } : {}),
  };

  const htmlJoined = refined.sections.map((s) => s.html).join("\n");
  const withClaims: GeneratedTailwindPage = {
    ...refined,
    contentClaimDiagnostics: buildContentClaimDiagnosticsReport(htmlJoined),
  };

  return { data: withClaims, ran: true, usedRefined: true };
}

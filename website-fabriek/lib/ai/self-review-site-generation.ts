/**
 * Tweede LLM-pass na eerste generatie: “eigen kwaliteitscontrole” op basis van briefing,
 * gejoinde HTML en programmatische checks (validate + claim diagnostics).
 * Geen echte screenshot/vision — het model “ziet” de pagina via structuur + markup (zoals Lovable-interne review).
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
import { postProcessClaudeTailwindPage } from "@/lib/ai/generate-site-postprocess";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import {
  claudeTailwindPageOutputSchema,
  mapClaudeOutputToSections,
  slugifyToSectionId,
  type ClaudeTailwindPageOutput,
  type GeneratedTailwindPage,
} from "@/lib/ai/tailwind-sections-schema";
import { validateGeneratedPageHtml } from "@/lib/ai/validate-generated-page";
import type { GenerationPipelineFeedback, StyleDetectionSource } from "@/lib/ai/generate-site-with-claude";

const MAX_DRAFT_JSON_CHARS = 380_000;

const SELF_REVIEW_SYSTEM = `Je bent senior QA en front-end reviser voor éénpagina Tailwind-marketing sites die als **JSON** (\`config\` + \`sections\` met HTML) worden geleverd.

Je krijgt de briefing, een **concept**-JSON, en **automatische checks** (validator + claim-scan). Behandel de markup alsof je de pagina visueel doorloopt: hiërarchie, hero-impact, redundante trust-blokken, generieke kaartenmuur, verticale lengte, en vooral **feitelijke integriteit**.

=== OUTPUT ===
- Antwoord met **alleen** één geldig JSON-object (geen markdown-fences, geen toelichting buiten JSON).
- Vorm: \`{ "config": { … }, "sections": [ { "id": "…", "html": "…", "name": "…?" } ] }\` — zelfde velden als het concept.
- Houd **hetzelfde aantal secties** en **dezelfde \`id\`’s in dezelfde volgorde** als het concept. Alleen \`html\` (en zo nodig \`name\`) inhoudelijk verbeteren; \`config\` alleen bij kleine correctie als die duidelijk botst met de briefing (kleur/font), niet opnieuw ontwerpen.

=== INHOUD (strikt) ===
${buildContentAuthorityPolicyBlock()}

=== VISUEEL / UX ===
- Ontbrekende \`<h1>\`, kapotte interne \`href="#…"\`, of zichtbare placeholder-copy: **repareren**.
- Verminder **onnodige lengte** binnen secties: dubbele stats/testimonial/CTA-banen samenvatten of één rustig blok maken **zonder** secties te droppen.
- Behoud \`data-animation\` en root-\`id\` op sectie waar geldig. Marquee: \`studio-marquee\` / \`studio-marquee-track\` alleen met dubbele set items (anders hapert de loop). **Laser:** als \`studio-laser-*\` staat op een **generieke** (niet-cyber) briefing zonder expliciete neon/sci-fi-wens → **verwijder** (te veel “template-decoratie”). Als wél passend: max. één rail in hero; \`relative\` parent; geen twee lasers genest op hetzelfde element.
- Sterkere typografie/contrast als het concept botst met de **briefing** (bijv. gevraagd warm/donker maar alles koud wit) — binnen Tailwind-utilities.
- **Hero heel kaal (effen donker zonder enige visuele laag):** alleen bijsturen als dat duidelijk zwak oogt **en** de briefing geen expliciet minimalisme vraagt — voeg desgewenst foto, gradient of textuur toe.
- **Header/menu met structureel slecht contrast** (bijv. lichte linktekst op lichte secties, of donkere links op donkere achtergrond): repareer met eenvoudige Tailwind- of Alpine-aanpassingen.
- **Hero zonder redelijke \`min-h-*\` op het buitenste blok:** kan een smalle strook + leeg wit in de preview geven — overweeg \`min-h-[72vh] md:min-h-[80vh]\` (of vergelijkbaar) tenzij de briefing anders wil.
- Als **PIPELINE-DETECTIE** in het user-bericht staat: het concept moet die **stijl (id)** en **branche** redelijk volgen; verbeter knal-contrast of verkeerde sfeer zodat het bij de gedetecteerde intent past (tenzij de briefing expliciet iets anders eist).
- **Stijlincoherentie:** als de pagina **twee botsende** esthetieken tegelijk als hoofdbeeld toont (bv. zware neumorphism + harde brutalism, of vol skeuomorphism + vol flat zonder briefing-reden), **vereenvoudig** naar **één** duidelijke richting die bij de gedetecteerde primaire stijl of de briefing past.
- **Dubbele navigatie:** als dezelfde site-menu-items **twee keer** prominent staan (topbar + verticale/zij-nav met identieke \`#…\` links), **snoei** tot **één** globale nav (behoud de sterkste; verwijder de dubbele lijst).
- **Typografie door elkaar:** footer/body in **Times-achtige** serif terwijl koppen brutal/cyber **sans** zijn — **trek recht**: één familie voor body + UI, of bewust **één** gepaarde serif alleen voor koppen **met** passende \`config.font\`; verhoog body-contrast op donker (\`text-gray-200\`+, geen \`font-light\` + \`text-gray-500\` op zwart).
- **Hero te druk t.o.v. briefing:** als de eerste sectie vol staat met tekst en knoppen terwijl de klant rust/luxe vraagt, **vereenvoudig** (kortere kop, minder knoppen, uitleg naar volgende sectie) — geen verplichte serif/knoppen-formule; hero zonder knoppen is prima tenzij de briefing anders vraagt.
- Vraagt de briefing **vintage / warm papier / old-school**: breng diensten-, trust- en testimonial-secties visueel in **dezelfde warme papierwereld** (crème/zand/stone-warm sectie-achtergronden); vervang dominerend \`bg-white\` op brede banden door passende warme tinten; geen willekeurige off-topic full-bleed beelden (bijv. verf/klus) tenzij de briefing dat zo noemt.`;

/**
 * Tweede LLM-pass staat **standaard uit** (latency, kosten, soms tegenstrijdige wijzigingen).
 * Aanzetten: `ENABLE_SITE_SELF_REVIEW=1` (of `true` / `yes`).
 * Harde uitzetten wint altijd: `DISABLE_SITE_SELF_REVIEW=1`.
 */
export function isSiteSelfReviewEnabled(): boolean {
  if (process.env.DISABLE_SITE_SELF_REVIEW === "1") return false;
  const v = process.env.ENABLE_SITE_SELF_REVIEW?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function generatedTailwindPageToClaudeOutput(page: GeneratedTailwindPage): ClaudeTailwindPageOutput {
  return {
    config: page.config,
    sections: page.sections.map((s, i) => ({
      id: s.id?.trim() ? s.id.trim() : slugifyToSectionId(s.sectionName, i),
      html: s.html,
      name: s.sectionName,
    })),
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

function buildSelfReviewUserPrompt(params: {
  businessName: string;
  description: string;
  draft: ClaudeTailwindPageOutput;
  validation: ReturnType<typeof validateGeneratedPageHtml>;
  claims: ContentClaimDiagnosticsReport;
  /** Zelfde detectie als pass 1 — zodat revisie weet welke designtaal bedoeld was. */
  pipelineInterpreted?: GenerationPipelineFeedback["interpreted"];
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

Als de markup **duidelijk** afwijkt van deze stijl (bijv. luxe flyer i.p.v. industrieel, of omgekeerd), **corrigeer** dan binnen dezelfde sectie-\`id\`'s en JSON-structuur. Bij twijfel: briefing + dit blok samen lezen.

`
    : "";

  return `=== BEDRIJF ===
${params.businessName.trim()}

=== BRIEFING ===
${params.description.trim()}

${pipelineBlock}

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
}): Promise<{ data: GeneratedTailwindPage; ran: boolean; usedRefined: boolean }> {
  const { client, model, businessName, description, draft, homepagePlan, preserveLayoutUpgrade, pipelineInterpreted } =
    options;

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
  const claims =
    draft.contentClaimDiagnostics ?? buildContentClaimDiagnosticsReport(joined);

  const user = buildSelfReviewUserPrompt({
    businessName,
    description,
    draft: claudeDraft,
    validation,
    claims,
    pipelineInterpreted,
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

  const validated = claudeTailwindPageOutputSchema.safeParse(parsedResult.value);
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

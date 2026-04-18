import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import Anthropic from "@anthropic-ai/sdk";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import { z } from "zod";

const COMPOSITION_PLAN_CALL_TIMEOUT_MS = 90_000;

const heroArchetypeSchema = z.enum([
  "typography_led",
  "split_media",
  "full_bleed_gradient",
  "minimal_photo",
  "editorial_statement",
]);

const ctaModeSchema = z.enum(["single_primary", "primary_secondary", "nav_plus_floating"]);

const copyDensitySchema = z.enum(["compact", "balanced"]);

const visualIntensitySchema = z.enum(["restrained", "expressive", "bold"]);

const sectionPlanEntrySchema = z.object({
  id: z.string().min(1).max(64),
  goalNl: z.string().min(8).max(240),
  maxBullets: z.number().int().min(0).max(12).optional(),
  maxWords: z.number().int().min(0).max(420).optional(),
});

const flagsSchema = z.object({
  testimonialsOnLanding: z.boolean(),
  galleryOnLanding: z.boolean(),
  pricingOnLanding: z.boolean(),
  faqOnLanding: z.boolean(),
});

const heroPlanSchema = z.object({
  archetype: heroArchetypeSchema,
  maxHeadlineWords: z.number().int().min(2).max(14).default(8),
  maxSubcopyWords: z.number().int().min(0).max(28).default(14),
  maxCtas: z.number().int().min(1).max(3).default(2),
});

export const siteCompositionPlanSchema = z.object({
  siteTypeNl: z.string().min(3).max(140),
  sectionPlans: z.array(sectionPlanEntrySchema).min(1).max(14),
  hero: heroPlanSchema,
  ctaStrategyNl: z.string().min(8).max(260),
  ctaMode: ctaModeSchema,
  copyDensity: copyDensitySchema,
  visualIntensity: visualIntensitySchema,
  flags: flagsSchema,
});

export type SiteCompositionPlan = z.infer<typeof siteCompositionPlanSchema>;
export type SectionPlanEntry = z.infer<typeof sectionPlanEntrySchema>;

const DEFAULT_GOALS: Partial<Record<string, string>> = {
  hero: "Sterke eerste indruk: merk, locatie of belofte + duidelijke primaire actie.",
  stats: "Bewijs of kernfeiten in één strakke band — geen verzonnen cijfers.",
  brands: "Vertrouwen via merken/partners — compact logo-ritme.",
  steps: "Proces of werkwijze in beknopte stappen.",
  features: "Diensten of USP’s: titel + max. één zin per item; geen brochure.",
  gallery: "Alleen relevante beelden; geen decoratieve vulling.",
  about: "Verhaal of positionering — kern, geen drie marketing-alinea’s.",
  shop: "Commerciële ingang naar assortiment — geen volledige catalogus.",
  team: "Mensen achter het bedrijf — korte bio’s.",
  testimonials: "Social proof — echte toon, geen fictieve namen.",
  pricing: "Heldere prijs- of pakketinfo waar de briefing ruimte voor geeft.",
  faq: "Antwoorden op echte twijfels — geen vulling.",
  cta: "Conversieband — herhaal niet de volledige contactpagina.",
  contact: "Contact + formulier — één helder blok (multipage).",
  footer: "Navigatie, juridisch, kerncontact — geen nieuwe verkoop-essay.",
};

function defaultSectionPlanEntry(id: string): SectionPlanEntry {
  return {
    id,
    goalNl: DEFAULT_GOALS[id] ?? `Geef ${id} inhoudelijk zin binnen de briefing; vermijd vulling en herhaling van andere secties.`,
    maxBullets: id === "features" || id === "faq" ? 4 : id === "testimonials" ? 3 : undefined,
    maxWords:
      id === "about"
        ? 90
        : id === "footer"
          ? 120
          : id === "hero"
            ? undefined
            : id === "faq"
              ? 220
              : undefined,
  };
}

function clampFlagsToCanonical(
  canonicalIds: readonly string[],
  flags: SiteCompositionPlan["flags"],
): SiteCompositionPlan["flags"] {
  const set = new Set(canonicalIds);
  return {
    testimonialsOnLanding: Boolean(flags.testimonialsOnLanding && set.has("testimonials")),
    galleryOnLanding: Boolean(flags.galleryOnLanding && set.has("gallery")),
    pricingOnLanding: Boolean(flags.pricingOnLanding && set.has("pricing")),
    faqOnLanding: Boolean(flags.faqOnLanding && set.has("faq")),
  };
}

/** Vult ontbrekende secties, sorteert op server-volgorde, kapt flags af op bestaande id’s. */
export function mergeCompositionPlanWithCanonical(
  canonicalSectionIds: readonly string[],
  raw: unknown,
): SiteCompositionPlan {
  const zod = siteCompositionPlanSchema.safeParse(raw);
  const byId = new Map<string, SectionPlanEntry>();
  if (zod.success) {
    for (const row of zod.data.sectionPlans) {
      byId.set(row.id.trim(), row);
    }
  }

  const heroDefaults = zod.success
    ? zod.data.hero
    : { archetype: "typography_led" as const, maxHeadlineWords: 8, maxSubcopyWords: 14, maxCtas: 2 };

  const baseFlags = zod.success
    ? zod.data.flags
    : {
        testimonialsOnLanding: false,
        galleryOnLanding: false,
        pricingOnLanding: false,
        faqOnLanding: false,
      };

  const sectionPlans = canonicalSectionIds.map((id) => {
    const hit = byId.get(id);
    if (hit) return { ...hit, id };
    return defaultSectionPlanEntry(id);
  });

  const siteTypeNl = zod.success
    ? zod.data.siteTypeNl
    : "Professionele dienstverlening — compacte one-pager of multipage volgens studio-contract.";

  return {
    siteTypeNl,
    sectionPlans,
    hero: heroDefaults,
    ctaStrategyNl: zod.success
      ? zod.data.ctaStrategyNl
      : "Eén primaire actie (bellen / WhatsApp / afspraak) plus optioneel secundair; geen CTA-zee.",
    ctaMode: zod.success ? zod.data.ctaMode : "primary_secondary",
    copyDensity: zod.success ? zod.data.copyDensity : "compact",
    visualIntensity: zod.success ? zod.data.visualIntensity : "expressive",
    flags: clampFlagsToCanonical(canonicalSectionIds, baseFlags),
  };
}

export function buildFallbackCompositionPlan(canonicalSectionIds: readonly string[]): SiteCompositionPlan {
  return mergeCompositionPlanWithCanonical(canonicalSectionIds, null);
}

function slimContractForPlan(contract: Record<string, unknown> | null | undefined): string {
  if (!contract || typeof contract !== "object") return "";
  const sig = contract.siteSignature as { archetype?: string; commitment_nl?: string } | undefined;
  const pick = {
    heroVisualSubject: contract.heroVisualSubject,
    paletteMode: contract.paletteMode,
    motionLevel: contract.motionLevel,
    siteSignature: sig
      ? { archetype: sig.archetype, commitment_nl: sig.commitment_nl?.toString().slice(0, 200) }
      : undefined,
  };
  return JSON.stringify(pick, null, 2);
}

const COMPOSITION_SYSTEM = `Je bent een senior UX-copywriter en informatiearchitect voor **Studio Gentrix**.

=== TAAK ===
Je schrijft **alleen** een **klein JSON-compositieplan** (geen HTML, geen Tailwind). Dit plan **begrenst** structuur en copy voor de volgende stap (HTML-generatie). De visuele uitwerking (layout, typografie, motion, kleur binnen theme) blijft **vrij** — jij kiest wel **intensiteit** en **dichtheid**.

=== REGELS ===
1. **Sectie-id’s:** De server levert de **exacte** volgorde van \`id\`'s voor de landingspagina. Jouw \`sectionPlans\` moet **precies één entry per id** bevatten, **dezelfde volgorde**, **geen extra id’s**, **geen weglaten**.
2. **Creativiteit:** Kies \`hero.archetype\`, \`visualIntensity\`, \`ctaMode\` en \`ctaStrategyNl\` passend bij sector en briefing — **niet** generiek SaaS-default tenzij de briefing dat echt is.
3. **Copy-budget:** Stel **realistische** \`maxWords\` / \`maxBullets\` per sectie in (hero: gebruik \`hero.max*\`, niet dubbel). **Compact** wint: liever te strak dan te lang.
4. **flags:** Alleen \`true\` als die **inhoud** echt op de **landings-secties** thuishoort (niet “misschien leuk”). Als de server geen \`testimonials\`/\`gallery\`/\`pricing\`/\`faq\` id geeft, zet die flag op \`false\`.

=== OUTPUT ===
Antwoord met **uitsluitend** één geldig JSON-object (geen markdown-fences).`;

export async function generateSiteCompositionPlanWithClaude(
  client: Anthropic,
  model: string,
  input: {
    businessName: string;
    description: string;
    canonicalSectionIds: readonly string[];
    strictLanding: boolean;
    marketingMultiPage: boolean;
    marketingPageSlugs?: readonly string[];
    designContractSummary?: Record<string, unknown> | null;
  },
): Promise<{ ok: true; raw: unknown } | { ok: false; error: string }> {
  const ids = [...input.canonicalSectionIds];
  const slugLine =
    input.marketingMultiPage && input.marketingPageSlugs?.length
      ? input.marketingPageSlugs.join(", ")
      : "(geen — one-pager of upgrade)";

  const user = `Bedrijfsnaam: ${input.businessName.trim().slice(0, 200) || "(niet opgegeven)"}

Briefing (samenvatting mag je gebruiken voor intentie):
${input.description.trim().slice(0, 8_000) || "(leeg)"}

--- VASTE LANDINGS-SECTIES (exact deze id's, deze volgorde) ---
${JSON.stringify(ids)}

Strikte compacte landing (server): ${input.strictLanding ? "ja — geen extra secties toevoegen in het plan." : "nee — volg nog steeds exact de id-lijst hierboven."}

Multipage marketingroutes actief: ${input.marketingMultiPage ? "ja" : "nee"}
${input.marketingMultiPage ? `Marketing-slugs (subpagina's, los van landing): ${slugLine}\nPlan: landing = compact; subpagina's = detail — geen volledige homepage herhalen per subroute.` : ""}

${input.designContractSummary ? `--- Designcontract (samenvatting — visuele richting, niet overschrijven met extra secties) ---\n${slimContractForPlan(input.designContractSummary)}` : ""}

Lever nu het JSON-compositieplan volgens het schema in je system prompt.`;

  try {
    const result = await Promise.race([
      (async () => {
        const message = await client.messages.create({
          model,
          max_tokens: clampMaxTokensNonStreaming(model, 2_048),
          system: COMPOSITION_SYSTEM,
          messages: [{ role: "user", content: user }],
        });
        await logClaudeMessageUsage("generate_site_composition_plan", model, message.usage);
        const textBlock = message.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          return { ok: false as const, error: "Geen tekst-antwoord voor compositieplan." };
        }
        const rawText = textBlock.text.trim();
        if (!rawText) {
          return { ok: false as const, error: "Leeg antwoord compositieplan." };
        }
        const parsed = parseModelJsonObject(rawText);
        if (!parsed.ok) {
          return { ok: false as const, error: "Compositieplan is geen parseerbare JSON." };
        }
        return { ok: true as const, raw: parsed.value };
      })(),
      new Promise<{ ok: false; error: string }>((resolve) =>
        setTimeout(
          () => resolve({ ok: false, error: `Compositieplan-timeout (${COMPOSITION_PLAN_CALL_TIMEOUT_MS / 1000}s).` }),
          COMPOSITION_PLAN_CALL_TIMEOUT_MS,
        ),
      ),
    ]);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Compositieplan-call mislukt.";
    return { ok: false, error: msg };
  }
}

/** Markdown voor injectie in de bouw-prompt (na Denklijn-contract). */
export function buildCompositionPlanPromptInjection(plan: SiteCompositionPlan): string {
  const lines: string[] = [];
  lines.push(`**Site-intentie (NL):** ${plan.siteTypeNl}`);
  lines.push(`**Copy-dichtheid:** ${plan.copyDensity} — hou tekst kort tenzij een enkele marketing-subpagina meer uitleg nodig heeft.`);
  lines.push(
    `**Visuele intensiteit:** ${plan.visualIntensity} — binnen \`config.theme\` en studio-CSS mag je ritme, contrast, motion en compositie **creatief** uitwerken; **niet** dit gebruiken om extra landings-secties of lange brochures te rechtvaardigen.`,
  );
  lines.push(`**CTA-modus:** ${plan.ctaMode} — ${plan.ctaStrategyNl}`);
  lines.push(`**Hero-aanpak:** ${plan.hero.archetype} — max. ${plan.hero.maxHeadlineWords} woorden in de hoofdkop, max. ${plan.hero.maxSubcopyWords} woorden subcopy (één regel), max. ${plan.hero.maxCtas} zichtbare primaire/secundaire CTA's in de hero.`);
  lines.push(
    `**Optionele blokken op landing (alleen als de id op de landingspagina bestaat):** testimonials=${plan.flags.testimonialsOnLanding}, gallery=${plan.flags.galleryOnLanding}, pricing=${plan.flags.pricingOnLanding}, faq=${plan.flags.faqOnLanding}.`,
  );
  lines.push("");
  lines.push("**Per-sectie (bindend voor copy — visuele lay-out vrij)**");
  for (const row of plan.sectionPlans) {
    const bullets = row.maxBullets != null ? `; max. **${row.maxBullets}** bullets/kaarten` : "";
    const words = row.maxWords != null ? `; max. **${row.maxWords}** woorden bodytekst in deze sectie` : "";
    lines.push(`- \`${row.id}\`: ${row.goalNl}${bullets}${words}`);
  }
  lines.push("");
  lines.push(
    "**No late structural compression:** overschrijf deze budgetten niet in de HTML-fase. Geen extra secties, geen dubbele contactblokken over de hele pagina, geen tweede volledige navbar.",
  );
  return lines.join("\n");
}

export function appendCompositionPlanToUserContent(
  userContent: string | ContentBlockParam[],
  planBlock: string,
): string | ContentBlockParam[] {
  const footer =
    "\n\n=== COMPOSITIEPLAN (bindend voor copy & dichtheid — niet voor sectie-id's) ===\n\n" +
    planBlock +
    "\n\n**HTML-fase:** Gebruik **exact** de verplichte sectie-\`id\`'s en volgorde uit §5 / de opdracht. Het compositieplan begrenst woorden, bullets en CTA-herhaling; **typografie, compositie, kleur, motion en sector-passende creativiteit** blijven vrij binnen het designcontract en de briefing.";

  if (typeof userContent === "string") {
    return `${userContent}${footer}`;
  }
  if (userContent.length === 0) {
    return [{ type: "text", text: footer.trim() }];
  }
  const last = userContent[userContent.length - 1];
  if (last?.type === "text" && "text" in last && typeof (last as { text: string }).text === "string") {
    const lt = last as { type: "text"; text: string };
    return [...userContent.slice(0, -1), { type: "text", text: `${lt.text}${footer}` }];
  }
  return [...userContent, { type: "text", text: footer.trim() }];
}

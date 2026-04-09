import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { KNOWLEDGE_JOURNAL_CATEGORY } from "@/lib/ai/knowledge-categories";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import {
  isLegacyTailwindPageConfig,
  type TailwindPageConfig,
} from "@/lib/ai/tailwind-sections-schema";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const journalResponseSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(12000),
});

export type ActivityJournalSource = "generate_site" | "edit_site" | "site_chat";

function isJournalEnabled(): boolean {
  return process.env.CLAUDE_ACTIVITY_JOURNAL !== "false";
}

function summarizeConfig(config: TailwindPageConfig | null | undefined): string {
  if (config == null) return "Geen config meegestuurd.";
  if (isLegacyTailwindPageConfig(config)) {
    return `Legacy-config: ${config.themeName}, primary ${config.primaryColor}`;
  }
  return `Stijl “${config.style}”, primary ${config.theme.primary}, accent ${config.theme.accent}`;
}

/** Feitenregels voor site-generatie (site studio). */
export function buildJournalFactsGenerateSite(input: {
  businessName: string;
  description: string;
  generationPackage: string;
  preserveLayoutUpgrade: boolean;
  sectionNames: string[];
  configSummaryLine: string;
  /** Default tailwind_sections; \`react_sections\` = React-sectie JSON. */
  outputFormat?: "tailwind_sections" | "react_sections";
}): string {
  const ids = input.sectionNames.join(", ") || "(geen namen)";
  const brief = input.description.slice(0, 500);
  const briefSuffix = input.description.length > 500 ? "…" : "";
  const action =
    input.outputFormat === "react_sections"
      ? "React-secties genereren (site studio)"
      : "Tailwind-site genereren (site studio)";
  return [
    `- Actie: ${action}`,
    `- Bedrijfsnaam: ${input.businessName}`,
    `- Product: ${input.generationPackage}`,
    `- Upgrade met behoud lay-out: ${input.preserveLayoutUpgrade ? "ja" : "nee"}`,
    `- Aantal secties: ${input.sectionNames.length}`,
    `- Sectielabels: ${ids}`,
    `- ${input.configSummaryLine}`,
    `- Briefing (begin): ${brief}${briefSuffix}`,
  ].join("\n");
}

/** Feitenregels voor AI-editor. */
export function buildJournalFactsEditSite(input: {
  instruction: string;
  sectionCount: number;
  config: TailwindPageConfig | null | undefined;
}): string {
  const instr = input.instruction.slice(0, 600);
  const suff = input.instruction.length > 600 ? "…" : "";
  return [
    `- Actie: site bewerken via AI-editor`,
    `- Aantal secties: ${input.sectionCount}`,
    `- ${summarizeConfig(input.config)}`,
    `- Instructie (begin): ${instr}${suff}`,
  ].join("\n");
}

/** Feitenregels voor site-chat. */
export function buildJournalFactsSiteChat(input: {
  lastUserMessage: string;
  siteChanged: boolean;
  sectionCount: number;
  config: TailwindPageConfig | null | undefined;
}): string {
  const last = input.lastUserMessage.slice(0, 600);
  const suff = input.lastUserMessage.length > 600 ? "…" : "";
  return [
    `- Actie: site-chat in editor`,
    `- Site-inhoud gewijzigd in deze beurt: ${input.siteChanged ? "ja" : "nee"}`,
    `- Aantal secties in huidige site: ${input.sectionCount}`,
    `- ${summarizeConfig(input.config)}`,
    `- Laatste gebruikersbericht (begin): ${last}${suff}`,
  ].join("\n");
}

/**
 * Tweede, kleine Claude-call: schrijft een inactief kennisbank-item onder “Claude activiteit”.
 * Faalt stil; beïnvloedt de hoofdactie niet. Uit met CLAUDE_ACTIVITY_JOURNAL=false.
 */
export async function tryAppendClaudeActivityJournal(params: {
  source: ActivityJournalSource;
  factsMarkdown: string;
}): Promise<void> {
  if (!isJournalEnabled()) return;

  const apiKey = getAnthropicApiKey();
  if (!apiKey) return;

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  const userPrompt = `Je schrijft een korte activiteitslog voor de beheerder van een webstudio (Nederlands).

Belangrijk:
- Baseer je ALLEEN op de feiten hieronder; verzin geen extra klanten, URLs of acties.
- Neutraal, zakelijk; geen excuses.
- Body: markdown toegestaan; 3–8 bullets of 2–4 zinnen. Wat gebeurde er, welke scope (pakket / editor / chat), welke concrete keuzes volgen uit de feiten (secties, stijl)?
- Titel: één regel, feitelijk (max ±90 tekens).

Feiten:
${params.factsMarkdown}

Lever uitsluitend één JSON-object, geen markdown eromheen:
{"title":"...","body":"..."}`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model,
      max_tokens: 1500,
      messages: [{ role: "user", content: userPrompt }],
    });

    await logClaudeMessageUsage("activity_journal", model, message.usage);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return;

    const parsed = parseModelJsonObject(textBlock.text);
    if (!parsed.ok) return;

    const validated = journalResponseSchema.safeParse(parsed.value);
    if (!validated.success) return;

    const supabase = createServiceRoleClient();
    const sortOrder = -Math.floor(Date.now() / 1000);

    const { error } = await supabase.from("ai_knowledge").insert({
      category: KNOWLEDGE_JOURNAL_CATEGORY,
      title: validated.data.title.trim().slice(0, 200),
      body: validated.data.body.trim().slice(0, 32000),
      is_active: false,
      sort_order: sortOrder,
      journal_source: params.source,
      auto_generated: true,
    });

    if (error && process.env.NODE_ENV === "development") {
      console.warn("[claude-activity-journal]", error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[claude-activity-journal]", e);
    }
  }
}

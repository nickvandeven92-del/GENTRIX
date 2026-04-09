import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import {
  assertAiCommandPostSanity,
  assertAiCommandPreMergeContract,
} from "@/lib/ai/ai-command-post-sanity";
import {
  assertAiPatchMutationPolicy,
  rejectForbiddenAiPatchShape,
} from "@/lib/ai/ai-patch-mutation-policy";
import { ANTHROPIC_KEY_MISSING_USER_HINT, getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { getKnowledgeContextForClaude } from "@/lib/data/ai-knowledge";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import { siteAiSnapshotPatchSchema } from "@/lib/ai/site-ai-command-patch-schema";
import { instructionForSiteAiCommand, type SiteAiCommandId } from "@/lib/ai/site-ai-commands";
import type { AiSiteCommandChangeReport } from "@/lib/site/ai-command-change-report-types";
import { mergeProjectSnapshotPatch } from "@/lib/site/merge-project-snapshot-patch";
import { lintProjectSnapshot } from "@/lib/site/project-snapshot-lint";
import { qualityHeuristicsProjectSnapshot } from "@/lib/site/project-snapshot-quality";
import type { ProjectSnapshot } from "@/lib/site/project-snapshot-schema";
import { getEffectivePageType } from "@/lib/site/snapshot-page-type";
import { TOKEN_OVERRIDE_KEYS } from "@/lib/site/project-snapshot-tokens";

export type { AiCommandPatchMetrics, AiSiteCommandChangeReport } from "@/lib/site/ai-command-change-report-types";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const TOKEN_OVERRIDE_KEYS_LIST = TOKEN_OVERRIDE_KEYS.join('", "');

const PATCH_OUTPUT_RULES = `=== OUTPUT (strikt) ===
Lever uitsluitend één JSON-object (geen markdown, geen code fences). Alleen keys die je wijzigt:

{
  "composition"?: { "contentDensity"?: "compact"|"normal"|"relaxed"|"generous", "layoutPresetId"?: string, "sectionIdsOrdered"?: string[], "pageType"?: "landing"|"legal"|"article"|"generic" },
  "theme"?: {
    "tokenOverrides"?: alleen keys uit: ["${TOKEN_OVERRIDE_KEYS_LIST}"],
    "pageConfig"?: gedeeltelijke master- of legacy-theme JSON (deep merge met bestaande config, zelfde variant) — volledige config alleen bij variantwissel of ontbrekende base
  },
  "sectionUpdates"?: [
    {
      "sectionId": string (verplicht — canonieke id uit snapshot.sections),
      "copyIntent"?: string (min. 3 tekens of weglaten),
      "semanticRole"?: "hero"|"features"|"cta"|"footer"|"nav"|"testimonials"|"pricing"|"contact"|"generic",
      "html"?: string,
      "sectionName"?: string
    }
  ],
  "meta"?: { "documentTitle"?: string },
  "siteConfig"?: object,
  "assets"?: { "customCss"?: string, "logoSet"?: object }  (geen customJs),
  "editor"?: object
}

Regels:
- **Targeting:** elke sectionUpdate **moet** **sectionId** hebben (geen positionele index in de patch).
- Geen volledige **sections**-array; geen format/schemaVersion.
- Voorkeur: composition + theme.tokenOverrides + sectionUpdates met copyIntent/semanticRole i.p.v. HTML.
- HTML alleen als nodig; behoud ankertjes/id’s in HTML.`;

export type ApplySiteAiCommandSnapshotResult =
  | { ok: true; snapshot: ProjectSnapshot; changeReport: AiSiteCommandChangeReport }
  | { ok: false; error: string; rawText?: string };

function unwrapPatchCandidate(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "patch" in raw) {
    const p = (raw as { patch?: unknown }).patch;
    if (p != null && typeof p === "object") return p;
  }
  return raw;
}

export async function applySiteAiCommandSnapshot(
  command: SiteAiCommandId,
  baseSnapshot: ProjectSnapshot,
): Promise<ApplySiteAiCommandSnapshotResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: `ANTHROPIC_API_KEY ontbreekt in de omgeving. ${ANTHROPIC_KEY_MISSING_USER_HINT}`,
    };
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  const { systemText: knowledge, userPrefixBlocks } = await getKnowledgeContextForClaude();
  const system = [
    knowledge,
    "Je bent een structurele site-editor. Je wijzigt project_snapshot_v1 via een compact JSON-patch-object (geen volledige snapshot, geen volledige sections-array).",
    PATCH_OUTPUT_RULES,
  ]
    .filter(Boolean)
    .join("\n\n");

  const commandIntent = instructionForSiteAiCommand(command);
  const userBody = `=== COMMANDO (${command}) ===
${commandIntent}

=== HUIDIGE PROJECT_SNAPSHOT (JSON) ===
${JSON.stringify(baseSnapshot)}`;

  const userContent: string | ContentBlockParam[] =
    userPrefixBlocks.length > 0
      ? [
          ...userPrefixBlocks,
          { type: "text", text: `\n\n=== AI-SITE-COMMANDO ===\n\n${userBody}` },
        ]
      : userBody;

  const message = await client.messages.create({
    model,
    max_tokens: clampMaxTokensNonStreaming(model, 24_576),
    system,
    messages: [{ role: "user", content: userContent }],
  });

  await logClaudeMessageUsage("ai_site_command_snapshot", model, message.usage);

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, error: "Geen tekst-antwoord van Claude ontvangen." };
  }

  const parsedResult = parseModelJsonObject(textBlock.text);
  if (!parsedResult.ok) {
    const truncated =
      message.stop_reason === "max_tokens" ? " Antwoord mogelijk afgekapt (max_tokens)." : "";
    return {
      ok: false,
      error: `Antwoord is geen geldige JSON.${truncated}`,
      rawText: textBlock.text,
    };
  }

  const candidate = unwrapPatchCandidate(parsedResult.value);

  const forbidden = rejectForbiddenAiPatchShape(candidate);
  if (!forbidden.ok) {
    return { ok: false, error: forbidden.error, rawText: textBlock.text };
  }

  const validated = siteAiSnapshotPatchSchema.safeParse(candidate);
  if (!validated.success) {
    return {
      ok: false,
      error: `Patch JSON voldoet niet aan het schema: ${validated.error.message}`,
      rawText: textBlock.text,
    };
  }

  const policy = assertAiPatchMutationPolicy(validated.data);
  if (!policy.ok) {
    return { ok: false, error: policy.error, rawText: textBlock.text };
  }

  const pre = assertAiCommandPreMergeContract(command, baseSnapshot);
  if (!pre.ok) {
    return { ok: false, error: pre.error, rawText: textBlock.text };
  }

  const snapshotJsonCharsBefore = JSON.stringify(baseSnapshot).length;
  const sectionUpdateCount = validated.data.sectionUpdates?.length ?? 0;

  const merged = mergeProjectSnapshotPatch(baseSnapshot, validated.data, { generationModel: model });
  if (!merged.ok) {
    return { ok: false, error: merged.error, rawText: textBlock.text };
  }

  const sanity = assertAiCommandPostSanity(command, baseSnapshot, merged.snapshot);
  if (!sanity.ok) {
    return { ok: false, error: sanity.error, rawText: textBlock.text };
  }

  const lintDiagnostics = lintProjectSnapshot(merged.snapshot);
  const qualityDiagnostics = qualityHeuristicsProjectSnapshot(merged.snapshot);
  const snapshotJsonCharsAfter = JSON.stringify(merged.snapshot).length;
  const pcm = merged.report.pageConfigMerge;
  const pageType = getEffectivePageType(merged.snapshot.composition.pageType);

  return {
    ok: true,
    snapshot: merged.snapshot,
    changeReport: {
      updatedSectionIds: merged.report.updatedSectionIds,
      updatedFields: merged.report.updatedFields,
      lintDiagnostics,
      qualityDiagnostics,
      metrics: {
        snapshotJsonCharsBefore,
        snapshotJsonCharsAfter,
        sectionUpdateCount,
        distinctSectionsUpdated: merged.report.updatedSectionIds.length,
        pageConfigMergeStrategy: pcm?.strategy ?? "none",
        pageConfigKeysInPatch: pcm?.keysInPatch ?? 0,
        lintDiagnosticCount: lintDiagnostics.length,
        qualityDiagnosticCount: qualityDiagnostics.length,
        pageType,
      },
    },
  };
}

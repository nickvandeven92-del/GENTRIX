import Anthropic from "@anthropic-ai/sdk";
import { generateDesignRationaleWithClaude } from "@/lib/ai/generate-design-rationale-with-claude";
import {
  buildDesignContractPromptInjection,
  type DesignGenerationContract,
} from "@/lib/ai/design-generation-contract";
import {
  appendCompositionPlanToUserContent,
  buildCompositionPlanPromptInjection,
  buildFallbackCompositionPlan,
  generateSiteCompositionPlanWithClaude,
  mergeCompositionPlanWithCanonical,
  type SiteCompositionPlan,
} from "@/lib/ai/site-composition-plan";
import {
  appendDesignContractToUserContent,
  executeGenerateSitePhase2,
  prepareGenerateSiteClaudeCall,
  type ExecuteGenerateSitePhase2Input,
  type GenerateSitePromptOptions,
  type PreparedGenerateSiteClaudeCall,
} from "@/lib/ai/generate-site-with-claude";
import {
  appendPrebakedHeroImageToUserContent,
  generateStudioHeroImagePublicUrl,
  shouldRunStudioHeroImagePipeline,
} from "@/lib/ai/ai-hero-image-postprocess";
import { getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { STUDIO_SITE_GENERATION } from "@/lib/ai/studio-generation-fixed-config";

/** Alles behalve `client` en `userContent` — die worden in fase 2 opnieuw opgebouwd. */
export type SerializedPreparedGenerateSiteClaudeCallV1 = Omit<
  PreparedGenerateSiteClaudeCall,
  "client" | "userContent"
>;

export type SiteGenerationJobCheckpointV1 = {
  v: 1;
  businessName: string;
  description: string;
  prepared: SerializedPreparedGenerateSiteClaudeCallV1;
  /** Exact dezelfde user-turn als vóór de hoofdstream in de monolithische pipeline. */
  userContentWithComposition: string | ContentBlockParam[];
  designContract: DesignGenerationContract | null;
  /** Alleen velden die na de stream nog nodig zijn (upgrade, subfolder, …). */
  promptOptionsTail?: Pick<GenerateSitePromptOptions, "preserveLayoutUpgrade" | "siteStorageSubfolderSlug">;
  /** Zelfde raster als monolithische asset-first stap; fase 2 injecteert zonder nieuwe upstream hero-call. */
  prebakedHeroPublicUrl?: string | null;
};

function serializePrepared(p: PreparedGenerateSiteClaudeCall): SerializedPreparedGenerateSiteClaudeCallV1 {
  const { client: _c, userContent: _u, ...rest } = p;
  return rest;
}

function hydratePrepared(serialized: SerializedPreparedGenerateSiteClaudeCallV1): PreparedGenerateSiteClaudeCall {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt — checkpoint fase 2 kan niet starten.");
  }
  const client = new Anthropic({ apiKey });
  return {
    ...serialized,
    client,
    userContent: "",
  };
}

export type SiteGenerationPhase1JobMeta = {
  pipeline_feedback_json: unknown;
  denklijn_text: string | null;
  denklijn_skip_reason: string | null;
  design_contract_json: unknown | null;
  design_contract_warning: string | null;
};

/**
 * Zelfde stappen als `createGenerateSiteReadableStream` tot net vóór “Pagina genereren”.
 * Checkpoint bevat de volledige `userContentWithComposition` — geen kwaliteitsverschil t.o.v. één run.
 */
export async function buildSiteGenerationCheckpointPhase1(params: {
  businessName: string;
  description: string;
  recentClientNames: string[];
  promptOptions?: GenerateSitePromptOptions;
}): Promise<
  | { ok: true; checkpoint: SiteGenerationJobCheckpointV1; meta: SiteGenerationPhase1JobMeta }
  | { ok: false; error: string }
> {
  const { businessName, description, recentClientNames, promptOptions } = params;

  const prepared = await prepareGenerateSiteClaudeCall(
    businessName,
    description,
    recentClientNames,
    promptOptions,
  );
  if ("ok" in prepared && prepared.ok === false) {
    return { ok: false, error: prepared.error };
  }
  const p = prepared as PreparedGenerateSiteClaudeCall;

  const rationale = await generateDesignRationaleWithClaude(p.client, p.supportModel, {
    businessName,
    description,
    feedback: p.pipelineFeedback,
    referenceSiteSnapshot: p.referenceSiteSnapshot,
  });

  let designContract: DesignGenerationContract | null = null;
  let contractWarning: string | null = null;
  if (rationale.ok) {
    if (rationale.contract != null) {
      designContract = rationale.contract;
      contractWarning = null;
    } else {
      designContract = null;
      contractWarning = "contractWarning" in rationale ? (rationale.contractWarning ?? null) : null;
    }
  }

  const meta: SiteGenerationPhase1JobMeta = {
    pipeline_feedback_json: JSON.parse(JSON.stringify(p.pipelineFeedback)) as unknown,
    denklijn_text: rationale.ok ? (rationale.text ?? null) : null,
    denklijn_skip_reason: rationale.ok ? null : (rationale.error?.trim().slice(0, 4_000) ?? null),
    design_contract_json: designContract ? (JSON.parse(JSON.stringify(designContract)) as unknown) : null,
    design_contract_warning: contractWarning?.trim().slice(0, 8_000) ?? null,
  };

  const userContentForGeneration =
    rationale.ok && rationale.contract != null
      ? appendDesignContractToUserContent(
          p.userContent,
          buildDesignContractPromptInjection(rationale.contract, p.referenceSiteSnapshot ?? null),
        )
      : p.userContent;

  const canonicalSectionIdsNs = p.pipelineFeedback.interpreted.sections ?? [];
  let compositionPlanNs: SiteCompositionPlan = buildFallbackCompositionPlan(canonicalSectionIdsNs);
  if (STUDIO_SITE_GENERATION.compositionPlanEnabled) {
    const contractSummaryNs =
      rationale.ok && rationale.contract != null
        ? (JSON.parse(JSON.stringify(rationale.contract)) as Record<string, unknown>)
        : null;
    const compNs = await generateSiteCompositionPlanWithClaude(p.client, p.supportModel, {
      businessName,
      description,
      canonicalSectionIds: canonicalSectionIdsNs,
      strictLanding: p.strictLandingContract,
      marketingMultiPage: p.useMarketingMultiPage,
      marketingPageSlugs: p.marketingPageSlugs,
      designContractSummary: contractSummaryNs,
    });
    compositionPlanNs = mergeCompositionPlanWithCanonical(canonicalSectionIdsNs, compNs.ok ? compNs.raw : null);
  }

  let userContentWithComposition = appendCompositionPlanToUserContent(
    userContentForGeneration,
    buildCompositionPlanPromptInjection(compositionPlanNs, p.marketingPageSlugs),
  );

  const clientImgCount = promptOptions?.clientImages?.length ?? 0;
  let prebakedHeroPublicUrl: string | null = null;
  if (shouldRunStudioHeroImagePipeline(description, clientImgCount)) {
    prebakedHeroPublicUrl = await generateStudioHeroImagePublicUrl({
      businessName,
      description,
      designContract,
      subfolderSlug: promptOptions?.siteStorageSubfolderSlug ?? null,
    });
    if (prebakedHeroPublicUrl) {
      userContentWithComposition = appendPrebakedHeroImageToUserContent(
        userContentWithComposition,
        prebakedHeroPublicUrl,
      );
    }
  }

  const checkpoint: SiteGenerationJobCheckpointV1 = {
    v: 1,
    businessName,
    description,
    prepared: serializePrepared(p),
    userContentWithComposition,
    designContract,
    prebakedHeroPublicUrl,
    promptOptionsTail: {
      ...(promptOptions?.preserveLayoutUpgrade != null
        ? { preserveLayoutUpgrade: promptOptions.preserveLayoutUpgrade }
        : {}),
      ...(promptOptions?.siteStorageSubfolderSlug != null
        ? { siteStorageSubfolderSlug: promptOptions.siteStorageSubfolderSlug }
        : {}),
    },
  };

  return { ok: true, checkpoint, meta };
}

export function parseSiteGenerationJobCheckpoint(raw: unknown): SiteGenerationJobCheckpointV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.businessName !== "string" || typeof o.description !== "string") return null;
  if (!o.prepared || typeof o.prepared !== "object") return null;
  if (o.userContentWithComposition == null) return null;
  return raw as SiteGenerationJobCheckpointV1;
}

export function buildPhase2InputFromCheckpoint(
  checkpoint: SiteGenerationJobCheckpointV1,
): ExecuteGenerateSitePhase2Input {
  const prepared = hydratePrepared(checkpoint.prepared);
  const tail = checkpoint.promptOptionsTail;
  const promptOptions: GenerateSitePromptOptions | undefined =
    tail && (tail.preserveLayoutUpgrade != null || tail.siteStorageSubfolderSlug != null)
      ? {
          ...(tail.preserveLayoutUpgrade != null ? { preserveLayoutUpgrade: tail.preserveLayoutUpgrade } : {}),
          ...(tail.siteStorageSubfolderSlug != null ? { siteStorageSubfolderSlug: tail.siteStorageSubfolderSlug } : {}),
        }
      : undefined;

  return {
    prepared,
    userContentWithComposition: checkpoint.userContentWithComposition,
    designContract: checkpoint.designContract,
    businessName: checkpoint.businessName,
    description: checkpoint.description,
    promptOptions,
    /** Fase 1 draait asset-first; fase 2 heeft geen parallelle prefetch in checkpoint. */
    prefetchedHeroB64Promise: Promise.resolve(null),
    prebakedHeroPublicUrl: checkpoint.prebakedHeroPublicUrl ?? null,
  };
}

export async function executeSiteGenerationFromCheckpoint(
  checkpoint: SiteGenerationJobCheckpointV1,
): ReturnType<typeof executeGenerateSitePhase2> {
  return executeGenerateSitePhase2(buildPhase2InputFromCheckpoint(checkpoint));
}

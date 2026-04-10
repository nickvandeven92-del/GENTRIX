import { z } from "zod";
import { sectionIdSchema } from "@/lib/ai/tailwind-sections-schema";
import { resolveSiteBlueprintId } from "@/lib/site/site-blueprint-registry";

export const SITE_IR_SCHEMA_VERSION = 1 as const;

export const siteIrRouteKeySchema = z.enum(["public_landing"]);

export const siteIrPageKindSchema = z.enum(["marketing_landing"]);

export const siteIrPrimaryPageSchema = z
  .object({
    routeKey: siteIrRouteKeySchema,
    kind: siteIrPageKindSchema,
  })
  .strict();

export const siteIrModuleSlotSchema = z
  .object({
    slot: z.enum(["before_footer", "after_hero", "primary_nav_actions"]),
    moduleId: z.string().min(1).max(48),
    intent: z.enum(["canonical_section", "embedded_fragment"]),
  })
  .strict();

export const siteIrV1Schema = z
  .object({
    schemaVersion: z.literal(SITE_IR_SCHEMA_VERSION),
    blueprintId: z.string().min(1).max(64),
    /** Branche-id uit generator-pipeline (optioneel). */
    detectedIndustryId: z.string().min(1).max(64).optional(),
    /**
     * Canonieke marketing-sectievolgorde (permutatie van snapshot-secties).
     * Leidend voor compose; `composition.sectionIdsOrdered` blijft hiermee gesynchroniseerd.
     */
    sectionIdsOrdered: z.array(sectionIdSchema).min(1).max(24).optional(),
    primaryPage: siteIrPrimaryPageSchema,
    moduleSlots: z.array(siteIrModuleSlotSchema).max(24),
  })
  .strict();

export type SiteIrV1 = z.infer<typeof siteIrV1Schema>;

export type BuildSiteIrV1Input = {
  blueprintId?: string | null;
  detectedIndustryId?: string | null;
  /** Marketing-sectievolgorde; wordt in snapshot altijd gelijk gehouden aan `composition.sectionIdsOrdered`. */
  sectionIdsOrdered?: readonly string[] | null;
};

/**
 * Deterministische Site IR v1 — geen HTML; beschrijft blueprint + primaire route + module-slots + optioneel volgorde.
 */
export function buildSiteIrV1(input?: BuildSiteIrV1Input): SiteIrV1 {
  const blueprint = resolveSiteBlueprintId(input?.blueprintId ?? undefined);
  const industry = input?.detectedIndustryId?.trim();
  const order = input?.sectionIdsOrdered?.filter((x) => typeof x === "string" && x.length > 0);
  const raw: SiteIrV1 = {
    schemaVersion: SITE_IR_SCHEMA_VERSION,
    blueprintId: blueprint.id,
    ...(industry && industry.length > 0 ? { detectedIndustryId: industry } : {}),
    ...(order != null && order.length > 0 ? { sectionIdsOrdered: [...order] } : {}),
    primaryPage: {
      routeKey: "public_landing",
      kind: "marketing_landing",
    },
    moduleSlots: [...blueprint.defaultModuleSlots()],
  };
  return siteIrV1Schema.parse(raw);
}

export function safeParseSiteIrV1(input: unknown): SiteIrV1 | null {
  const r = siteIrV1Schema.safeParse(input);
  return r.success ? r.data : null;
}

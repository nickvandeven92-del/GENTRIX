import { generatedSiteSchema, type GeneratedSite } from "@/lib/ai/generated-site-schema";
import {
  studioRasterBrandSetSchema,
  tailwindPageConfigSchema,
  tailwindSectionSchema,
  tailwindSectionsArraySchema,
  type StudioRasterBrandSet,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { parseReactSiteDocument, type ReactSiteDocument } from "@/lib/site/react-site-schema";
import { parseAnyStoredProjectDataToLatestSnapshot } from "@/lib/site/project-snapshot-migrate";
import {
  projectSnapshotToTailwindSectionsPayload,
  type SnapshotPageType,
} from "@/lib/site/project-snapshot-schema";
import { generatedLogoSetSchema, type GeneratedLogoSet } from "@/types/logo";
import { snapshotPageTypeSchema } from "@/lib/site/snapshot-page-type";
import { SNAPSHOT_TAILWIND_COMPILED_CSS_MAX } from "@/lib/site/project-snapshot-constants";
import type { SiteIrV1 } from "@/lib/site/site-ir-schema";
import { z } from "zod";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";

export type ParsedStoredSite =
  | { kind: "legacy"; site: GeneratedSite }
  | { kind: "react"; doc: ReactSiteDocument }
  | {
      kind: "tailwind";
      sections: TailwindSection[];
      pageType?: SnapshotPageType;
      config?: TailwindPageConfig;
      customCss?: string;
      customJs?: string;
      logoSet?: GeneratedLogoSet;
      rasterBrandSet?: StudioRasterBrandSet;
      /** Server-build Tailwind CSS (minified); live zonder Play CDN. */
      tailwindCompiledCss?: string;
      /** Afkomstig uit `project_snapshot_v1.composition` — alleen voor compose-volgorde. */
      sectionIdsOrdered?: string[];
      siteIr?: SiteIrV1;
      contactSections?: TailwindSection[];
      marketingPages?: Record<string, TailwindSection[]>;
      /** Denklijn-contract wanneer aanwezig in snapshot/site-JSON — nav-preset infer server-side. */
      designContract?: DesignGenerationContract;
    };

/** Secties + optionele config zonder `format: "tailwind_sections"` (sommige handmatige exports). */
const tailwindSectionsLooseSchema = z.object({
  sections: tailwindSectionsArraySchema,
  contactSections: z.array(tailwindSectionSchema).min(1).max(12).optional(),
  marketingPages: z.record(z.string(), z.array(tailwindSectionSchema).min(1).max(16)).optional(),
  pageType: snapshotPageTypeSchema.optional(),
  config: tailwindPageConfigSchema.optional(),
  customCss: z.string().max(48_000).optional(),
  customJs: z.string().max(48_000).optional(),
  logoSet: generatedLogoSetSchema.optional(),
  rasterBrandSet: studioRasterBrandSetSchema.optional(),
  tailwindCompiledCss: z.string().max(SNAPSHOT_TAILWIND_COMPILED_CSS_MAX).optional(),
});

function tailwindParsedFromSnapshotFlow(input: unknown): ParsedStoredSite | null {
  const latest = parseAnyStoredProjectDataToLatestSnapshot(input, {});
  if (!latest.ok) return null;
  const tw = projectSnapshotToTailwindSectionsPayload(latest.snapshot);
  const snap = latest.snapshot;
  const orderFromIr =
    snap.siteIr?.sectionIdsOrdered != null &&
    snap.siteIr.sectionIdsOrdered.length === snap.sections.length
      ? [...snap.siteIr.sectionIdsOrdered]
      : [...snap.composition.sectionIdsOrdered];

  return {
    kind: "tailwind",
    sections: tw.sections,
    ...(tw.pageType != null ? { pageType: tw.pageType } : {}),
    config: tw.config,
    ...(tw.customCss != null && tw.customCss !== "" ? { customCss: tw.customCss } : {}),
    ...(tw.customJs != null && tw.customJs !== "" ? { customJs: tw.customJs } : {}),
    ...(tw.logoSet != null ? { logoSet: tw.logoSet } : {}),
    ...(tw.rasterBrandSet != null ? { rasterBrandSet: tw.rasterBrandSet } : {}),
    ...(tw.tailwindCompiledCss != null && tw.tailwindCompiledCss.trim() !== ""
      ? { tailwindCompiledCss: tw.tailwindCompiledCss }
      : {}),
    sectionIdsOrdered: orderFromIr,
    ...(snap.siteIr != null ? { siteIr: snap.siteIr } : {}),
    ...(tw.contactSections != null && tw.contactSections.length > 0 ? { contactSections: tw.contactSections } : {}),
    ...(tw.marketingPages != null && Object.keys(tw.marketingPages).length > 0
      ? { marketingPages: tw.marketingPages }
      : {}),
    ...(snap.designContract != null ? { designContract: snap.designContract } : {}),
  };
}

export function parseStoredSiteData(input: unknown): ParsedStoredSite | null {
  const reactDoc = parseReactSiteDocument(input);
  if (reactDoc) {
    return { kind: "react", doc: reactDoc };
  }

  const fromCanonical = tailwindParsedFromSnapshotFlow(input);
  if (fromCanonical) return fromCanonical;

  const loose = tailwindSectionsLooseSchema.safeParse(input);
  if (loose.success) {
    const wrapped = { format: "tailwind_sections" as const, ...loose.data };
    const fromLoose = tailwindParsedFromSnapshotFlow(wrapped);
    if (fromLoose) return fromLoose;
  }

  const legacy = generatedSiteSchema.safeParse(input);
  if (legacy.success) {
    return { kind: "legacy", site: legacy.data };
  }
  return null;
}

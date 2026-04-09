import { generatedSiteSchema, type GeneratedSite } from "@/lib/ai/generated-site-schema";
import {
  tailwindPageConfigSchema,
  tailwindSectionsArraySchema,
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
import { z } from "zod";

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
    };

/** Secties + optionele config zonder `format: "tailwind_sections"` (sommige handmatige exports). */
const tailwindSectionsLooseSchema = z.object({
  sections: tailwindSectionsArraySchema,
  pageType: snapshotPageTypeSchema.optional(),
  config: tailwindPageConfigSchema.optional(),
  customCss: z.string().max(48_000).optional(),
  customJs: z.string().max(48_000).optional(),
  logoSet: generatedLogoSetSchema.optional(),
});

function tailwindParsedFromSnapshotFlow(input: unknown): ParsedStoredSite | null {
  const latest = parseAnyStoredProjectDataToLatestSnapshot(input, {});
  if (!latest.ok) return null;
  const tw = projectSnapshotToTailwindSectionsPayload(latest.snapshot);
  return {
    kind: "tailwind",
    sections: tw.sections,
    ...(tw.pageType != null ? { pageType: tw.pageType } : {}),
    config: tw.config,
    ...(tw.customCss != null && tw.customCss !== "" ? { customCss: tw.customCss } : {}),
    ...(tw.customJs != null && tw.customJs !== "" ? { customJs: tw.customJs } : {}),
    ...(tw.logoSet != null ? { logoSet: tw.logoSet } : {}),
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

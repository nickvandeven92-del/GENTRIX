import type { GeneratedSite } from "@/lib/ai/generated-site-schema";
import {
  normalizeGenerationPackageId,
  type GenerationPackageId,
} from "@/lib/ai/generation-packages";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { ReactSiteDocument } from "@/lib/site/react-site-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { parseStoredSiteData, type ParsedStoredSite } from "@/lib/site/parse-stored-site-data";
import type { SiteIrV1 } from "@/lib/site/site-ir-schema";

/** Publieke weergave — zelfde union als `get-published-site` (render- en export-paden). */
export type PublishedSitePayload =
  | {
      kind: "legacy";
      site: GeneratedSite;
      clientName: string;
      generationPackage: GenerationPackageId;
    }
  | {
      kind: "tailwind";
      sections: TailwindSection[];
      clientName: string;
      config?: TailwindPageConfig;
      generationPackage: GenerationPackageId;
      customCss?: string;
      customJs?: string;
      logoSet?: GeneratedLogoSet;
      tailwindCompiledCss?: string;
      /** Snapshot-compositie: permutatie van sectie-`id`'s voor compose (geen ontwerp-lock). */
      sectionIdsOrdered?: string[];
      /** Site IR v1 wanneer bron `project_snapshot_v1` was. */
      siteIr?: SiteIrV1;
      /** Aparte `/contact`-HTML; ontbreekt bij legacy one-pager. */
      contactSections?: TailwindSection[];
      /** Subroutes `/site/{slug}/<key>`. */
      marketingPages?: Record<string, TailwindSection[]>;
      /** Denklijn-contract wanneer in snapshot/JSON opgenomen — server infer nav-preset. */
      designContract?: DesignGenerationContract;
    }
  | {
      kind: "react";
      doc: ReactSiteDocument;
      clientName: string;
      generationPackage: GenerationPackageId;
    };

/**
 * Parse JSON → payload voor `PublishedSiteView` / video-URL / export HTML-pipeline.
 * Eén plek voor preview/live parity op data-niveau.
 */
export function publishedPayloadFromSiteJson(
  siteJson: unknown,
  clientName: string,
  generationPackageRaw: string | null | undefined,
): PublishedSitePayload | null {
  const parsed = parseStoredSiteData(siteJson);
  if (!parsed) return null;
  return publishedPayloadFromParsed(parsed, clientName, generationPackageRaw);
}

export function publishedPayloadFromParsed(
  parsed: ParsedStoredSite,
  clientName: string,
  generationPackageRaw: string | null | undefined,
): PublishedSitePayload | null {
  const generationPackage = normalizeGenerationPackageId(generationPackageRaw ?? undefined);

  if (parsed.kind === "tailwind") {
    return {
      kind: "tailwind",
      sections: parsed.sections,
      clientName,
      config: parsed.config,
      generationPackage,
      ...(parsed.customCss != null && parsed.customCss !== "" ? { customCss: parsed.customCss } : {}),
      ...(parsed.customJs != null && parsed.customJs !== "" ? { customJs: parsed.customJs } : {}),
      ...(parsed.logoSet != null ? { logoSet: parsed.logoSet } : {}),
      ...(parsed.tailwindCompiledCss != null && parsed.tailwindCompiledCss.trim() !== ""
        ? { tailwindCompiledCss: parsed.tailwindCompiledCss }
        : {}),
      ...(parsed.sectionIdsOrdered != null && parsed.sectionIdsOrdered.length > 0
        ? { sectionIdsOrdered: [...parsed.sectionIdsOrdered] }
        : {}),
      ...(parsed.siteIr != null ? { siteIr: parsed.siteIr } : {}),
      ...(parsed.contactSections != null && parsed.contactSections.length > 0
        ? { contactSections: parsed.contactSections }
        : {}),
      ...(parsed.marketingPages != null && Object.keys(parsed.marketingPages).length > 0
        ? { marketingPages: parsed.marketingPages }
        : {}),
      ...(parsed.designContract != null ? { designContract: parsed.designContract } : {}),
    };
  }
  if (parsed.kind === "react") {
    return { kind: "react", doc: parsed.doc, clientName, generationPackage };
  }
  return { kind: "legacy", site: parsed.site, clientName, generationPackage };
}

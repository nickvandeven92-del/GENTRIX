import {
  marketingPageKeyStoredSchema,
  slugifyToSectionId,
  tailwindSectionsPayloadSchema,
} from "@/lib/ai/tailwind-sections-schema";
import { assertProjectSnapshotInvariants } from "@/lib/site/project-snapshot-invariants";
import {
  PROJECT_SNAPSHOT_FORMAT,
  filterTokenOverrideRecord,
  isProjectSnapshotV1,
  safeParseProjectSnapshot,
  snapshotCreatedByKindSchema,
  tailwindSectionsPayloadToProjectSnapshot,
  type GenerationContext,
  type ProjectSnapshot,
} from "@/lib/site/project-snapshot-schema";
import {
  buildSiteIrV1,
  ensureSiteIrStandardModuleRoutes,
  safeParseSiteIrV1,
  siteIrV1Schema,
} from "@/lib/site/site-ir-schema";
import { LAYOUT_PRESET_IDS } from "@/lib/site/project-snapshot-layout";
import { CONTENT_DENSITY_VALUES } from "@/lib/site/project-snapshot-layout";
import { SNAPSHOT_PAGE_TYPES } from "@/lib/site/snapshot-page-type";
import type { z } from "zod";

export type NormalizeContext = {
  generationSource?: GenerationContext["source"];
  documentTitle?: string;
  /** Voor tests: vaste “nu”. */
  nowIso?: string;
};

export type ParseAnyStoredProjectSnapshotResult =
  | { ok: true; snapshot: ProjectSnapshot }
  | { ok: false; error: string };

function mapGenerationSourceToCreatedBy(
  source: GenerationContext["source"] | undefined,
): z.infer<typeof snapshotCreatedByKindSchema> {
  switch (source) {
    case "generator":
      return "generator";
    case "editor":
      return "editor";
    case "ai_command":
      return "ai_command";
    case "migration":
      return "migration";
    case "import":
      return "import";
    default:
      return "unknown";
  }
}

/**
 * Losse / oudere `project_snapshot_v1`-objecten → strikt schema + invarianten.
 */
export function upgradeLooseProjectSnapshotV1(
  raw: Record<string, unknown>,
  ctx: NormalizeContext,
): Record<string, unknown> {
  const now = ctx.nowIso ?? new Date().toISOString();
  const format = raw.format === PROJECT_SNAPSHOT_FORMAT ? PROJECT_SNAPSHOT_FORMAT : PROJECT_SNAPSHOT_FORMAT;
  const metaIn = (raw.meta as Record<string, unknown> | undefined) ?? {};
  const genIn = (raw.generation as Record<string, unknown> | undefined) ?? {};
  const source = genIn.source as GenerationContext["source"] | undefined;

  const createdByKind =
    typeof metaIn.createdByKind === "string" && snapshotCreatedByKindSchema.safeParse(metaIn.createdByKind).success
      ? metaIn.createdByKind
      : mapGenerationSourceToCreatedBy(source);

  const meta = {
    schemaVersion: 1,
    ...(typeof metaIn.documentTitle === "string" && metaIn.documentTitle.trim() !== ""
      ? { documentTitle: metaIn.documentTitle.trim() }
      : {}),
    createdByKind,
    createdAt: typeof metaIn.createdAt === "string" ? metaIn.createdAt : now,
    lastModifiedAt: typeof metaIn.lastModifiedAt === "string" ? metaIn.lastModifiedAt : now,
  };

  const siteConfig = { ...((raw.siteConfig as object) ?? {}) };
  const sectionsRaw = Array.isArray(raw.sections) ? raw.sections : [];
  const sections = sectionsRaw.map((row: unknown, i: number) => {
    if (!row || typeof row !== "object") {
      return { id: `section-${i}`, sectionName: `Section ${i + 1}`, html: "<section></section>" };
    }
    const s = row as Record<string, unknown>;
    const sectionName = typeof s.sectionName === "string" ? s.sectionName : `Section ${i + 1}`;
    const html = typeof s.html === "string" ? s.html : "<section></section>";
    const id =
      typeof s.id === "string" && /^[a-z0-9-]{1,64}$/.test(s.id)
        ? s.id
        : slugifyToSectionId(sectionName, i);
    const out: Record<string, unknown> = { id, sectionName: sectionName.trim(), html };
    if (typeof s.semanticRole === "string") out.semanticRole = s.semanticRole;
    if (typeof s.copyIntent === "string") out.copyIntent = s.copyIntent;
    return out;
  });

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i] as Record<string, unknown>;
    if (s.semanticRole === "hero" && i !== 0) {
      s.semanticRole = "generic";
    }
  }

  const contactSectionsRaw = Array.isArray(raw.contactSections) ? raw.contactSections : [];
  const contactSections = contactSectionsRaw.map((row: unknown, i: number) => {
    if (!row || typeof row !== "object") {
      return { id: `contact-section-${i}`, sectionName: `Contact ${i + 1}`, html: "<section></section>" };
    }
    const s = row as Record<string, unknown>;
    const sectionName = typeof s.sectionName === "string" ? s.sectionName : `Contact ${i + 1}`;
    const html = typeof s.html === "string" ? s.html : "<section></section>";
    const id =
      typeof s.id === "string" && /^[a-z0-9-]{1,64}$/.test(s.id)
        ? s.id
        : slugifyToSectionId(sectionName, i);
    const out: Record<string, unknown> = { id, sectionName: sectionName.trim(), html };
    if (typeof s.semanticRole === "string") out.semanticRole = s.semanticRole;
    if (typeof s.copyIntent === "string") out.copyIntent = s.copyIntent;
    return out;
  });

  const mpIn = raw.marketingPages;
  const marketingPages: Record<string, Record<string, unknown>[]> = {};
  if (mpIn != null && typeof mpIn === "object" && !Array.isArray(mpIn)) {
    for (const [rawKey, rows] of Object.entries(mpIn as Record<string, unknown>)) {
      const keyParsed = marketingPageKeyStoredSchema.safeParse(rawKey);
      if (!keyParsed.success || !Array.isArray(rows)) continue;
      const key = keyParsed.data;
      marketingPages[key] = rows.map((row: unknown, i: number) => {
        if (!row || typeof row !== "object") {
          return { id: `${key}-section-${i}`, sectionName: `Pagina ${i + 1}`, html: "<section></section>" };
        }
        const s = row as Record<string, unknown>;
        const sectionName = typeof s.sectionName === "string" ? s.sectionName : `Pagina ${i + 1}`;
        const html = typeof s.html === "string" ? s.html : "<section></section>";
        const id =
          typeof s.id === "string" && /^[a-z0-9-]{1,64}$/.test(s.id)
            ? s.id
            : slugifyToSectionId(sectionName, i);
        const out: Record<string, unknown> = { id, sectionName: sectionName.trim(), html };
        if (typeof s.semanticRole === "string") out.semanticRole = s.semanticRole;
        if (typeof s.copyIntent === "string") out.copyIntent = s.copyIntent;
        return out;
      });
    }
  }
  const hasMarketingPages = Object.keys(marketingPages).length > 0;

  const ids = sections.map((s) => (s as { id: string }).id);
  const compIn = (raw.composition as Record<string, unknown> | undefined) ?? {};
  let sectionIdsOrdered = Array.isArray(compIn.sectionIdsOrdered)
    ? compIn.sectionIdsOrdered.filter((x): x is string => typeof x === "string")
    : [];
  if (sectionIdsOrdered.length !== sections.length) {
    sectionIdsOrdered = [...ids];
  }
  const composition: Record<string, unknown> = { sectionIdsOrdered };
  const rawPreset = typeof compIn.layoutPresetId === "string" ? compIn.layoutPresetId : null;
  composition.layoutPresetId =
    rawPreset && (LAYOUT_PRESET_IDS as readonly string[]).includes(rawPreset) ? rawPreset : "default";
  const rawDensity = typeof compIn.contentDensity === "string" ? compIn.contentDensity : null;
  if (rawDensity && (CONTENT_DENSITY_VALUES as readonly string[]).includes(rawDensity)) {
    composition.contentDensity = rawDensity;
  }
  const rawPageType = typeof compIn.pageType === "string" ? compIn.pageType : null;
  if (rawPageType && (SNAPSHOT_PAGE_TYPES as readonly string[]).includes(rawPageType)) {
    composition.pageType = rawPageType;
  }

  const themeIn = (raw.theme as Record<string, unknown> | undefined) ?? {};
  const tokenOverrides = filterTokenOverrideRecord(
    themeIn.tokenOverrides as Record<string, string> | undefined,
  );

  const theme: Record<string, unknown> = {
    tokenOverrides,
    ...(themeIn.pageConfig !== undefined ? { pageConfig: themeIn.pageConfig } : {}),
  };

  const assets = { ...((raw.assets as object) ?? {}) };
  const editor = { ...((raw.editor as object) ?? {}) };
  const generation = { ...genIn };

  const compOrdered = composition.sectionIdsOrdered as string[];
  const hasDedicatedContactPage = contactSections.length > 0;
  let siteIr =
    safeParseSiteIrV1(raw.siteIr) ??
    buildSiteIrV1({
      hasDedicatedContactPage,
    });
  if (
    (!siteIr.sectionIdsOrdered || siteIr.sectionIdsOrdered.length === 0) &&
    compOrdered.length > 0 &&
    compOrdered.length === sections.length
  ) {
    siteIr = siteIrV1Schema.parse({ ...siteIr, sectionIdsOrdered: [...compOrdered] });
  }
  if (hasDedicatedContactPage && !siteIr.activeRoutes?.includes("public_contact")) {
    siteIr = siteIrV1Schema.parse({
      ...siteIr,
      activeRoutes: ["public_landing", "public_contact"],
      routes: [
        { routeKey: "public_landing", path: "/", kind: "marketing_landing" },
        { routeKey: "public_contact", path: "/contact", kind: "contact_page" },
      ],
    });
  }
  siteIr = ensureSiteIrStandardModuleRoutes(siteIr);

  return {
    format,
    meta,
    siteConfig,
    composition,
    sections,
    ...(hasDedicatedContactPage ? { contactSections } : {}),
    ...(hasMarketingPages ? { marketingPages } : {}),
    theme,
    assets,
    editor,
    generation,
    siteIr,
  };
}

export function migrateProjectSnapshotToLatest(input: unknown): ProjectSnapshot {
  const r = parseAnyStoredProjectDataToLatestSnapshot(input, {});
  if (!r.ok) throw new Error(r.error);
  return r.snapshot;
}

/**
 * Enige aanbevolen entry voor reads: strict, anders loose v1-upgrade, anders tailwind legacy.
 */
export function parseAnyStoredProjectDataToLatestSnapshot(
  input: unknown,
  ctx: NormalizeContext = {},
): ParseAnyStoredProjectSnapshotResult {
  const first = safeParseProjectSnapshot(input);
  if (first.ok) {
    const inv = assertProjectSnapshotInvariants(first.data);
    if (!inv.ok) {
      return { ok: false, error: inv.errors.join("; ") };
    }
    return { ok: true, snapshot: first.data };
  }

  if (isProjectSnapshotV1(input) && typeof input === "object" && input !== null) {
    const upgraded = upgradeLooseProjectSnapshotV1(input as Record<string, unknown>, ctx);
    const second = safeParseProjectSnapshot(upgraded);
    if (second.ok) {
      const inv = assertProjectSnapshotInvariants(second.data);
      if (!inv.ok) {
        return { ok: false, error: inv.errors.join("; ") };
      }
      return { ok: true, snapshot: second.data };
    }
    return { ok: false, error: second.error };
  }

  const tw = tailwindSectionsPayloadSchema.safeParse(input);
  if (tw.success) {
    const snap = tailwindSectionsPayloadToProjectSnapshot(tw.data, {
      generationSource: ctx.generationSource ?? "import",
      documentTitle: ctx.documentTitle,
    });
    const inv = assertProjectSnapshotInvariants(snap);
    if (!inv.ok) {
      return { ok: false, error: inv.errors.join("; ") };
    }
    return { ok: true, snapshot: snap };
  }

  return {
    ok: false,
    error: `Geen te parsen project_snapshot_v1 of tailwind_sections: ${first.error}`,
  };
}

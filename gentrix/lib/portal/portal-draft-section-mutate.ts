import {
  tailwindSectionsPayloadSchema,
  type TailwindSection,
  type TailwindSectionsPayload,
} from "@/lib/ai/tailwind-sections-schema";
import { normalizeUnknownToProjectSnapshot } from "@/lib/site/project-snapshot-io";
import { projectSnapshotToTailwindSectionsPayload } from "@/lib/site/project-snapshot-schema";
import { sanitizeTailwindFragment } from "@/lib/site/tailwind-page-html";
import { SNAPSHOT_DOCUMENT_TITLE_MAX } from "@/lib/site/project-snapshot-constants";

export type PortalDraftSectionRow = {
  /** Stabiele sleutel voor PATCH, bv. `main:0` of `contact:1`. */
  key: string;
  sectionName: string;
  html: string;
};

function cloneSection(s: TailwindSection): TailwindSection {
  return { ...s };
}

function cloneTailwindPayload(payload: TailwindSectionsPayload): TailwindSectionsPayload {
  return tailwindSectionsPayloadSchema.parse({
    format: "tailwind_sections",
    sections: payload.sections.map(cloneSection),
    ...(payload.pageType != null ? { pageType: payload.pageType } : {}),
    ...(payload.config != null ? { config: payload.config } : {}),
    ...(payload.contactSections?.length ? { contactSections: payload.contactSections.map(cloneSection) } : {}),
    ...(payload.marketingPages && Object.keys(payload.marketingPages).length > 0
      ? {
          marketingPages: Object.fromEntries(
            Object.entries(payload.marketingPages).map(([k, arr]) => [k, arr.map(cloneSection)]),
          ),
        }
      : {}),
    ...(payload.customCss != null && payload.customCss !== "" ? { customCss: payload.customCss } : {}),
    ...(payload.customJs != null && payload.customJs !== "" ? { customJs: payload.customJs } : {}),
    ...(payload.logoSet != null ? { logoSet: payload.logoSet } : {}),
    ...(payload.tailwindCompiledCss != null && payload.tailwindCompiledCss.trim() !== ""
      ? { tailwindCompiledCss: payload.tailwindCompiledCss }
      : {}),
  });
}

function parseKey(raw: string): { kind: "main" | "contact" | "marketing"; index: number; page?: string } | null {
  const t = raw.trim();
  const main = /^main:(\d+)$/.exec(t);
  if (main) return { kind: "main", index: Number(main[1]) };
  const contact = /^contact:(\d+)$/.exec(t);
  if (contact) return { kind: "contact", index: Number(contact[1]) };
  const mkt = /^marketing:([a-z0-9-]+):(\d+)$/.exec(t);
  if (mkt) return { kind: "marketing", page: mkt[1], index: Number(mkt[2]) };
  return null;
}

export function listPortalDraftSectionRows(payload: TailwindSectionsPayload): PortalDraftSectionRow[] {
  const out: PortalDraftSectionRow[] = [];
  payload.sections.forEach((s, index) => {
    out.push({ key: `main:${index}`, sectionName: s.sectionName, html: s.html });
  });
  const contact = payload.contactSections;
  if (contact?.length) {
    contact.forEach((s, index) => {
      out.push({ key: `contact:${index}`, sectionName: `[Contact] ${s.sectionName}`, html: s.html });
    });
  }
  const pages = payload.marketingPages;
  if (pages) {
    for (const [pageKey, secs] of Object.entries(pages)) {
      secs.forEach((s, index) => {
        out.push({
          key: `marketing:${pageKey}:${index}`,
          sectionName: `[${pageKey}] ${s.sectionName}`,
          html: s.html,
        });
      });
    }
  }
  return out;
}

export function loadTailwindPayloadFromDraftJson(
  draftJson: unknown,
): { ok: true; payload: TailwindSectionsPayload; documentTitle: string | null } | { ok: false; error: string } {
  const norm = normalizeUnknownToProjectSnapshot(draftJson, { generationSource: "editor" });
  if (!norm.ok) {
    return { ok: false, error: norm.error };
  }
  const snap = norm.snapshot;
  const payload = projectSnapshotToTailwindSectionsPayload(snap);
  const title = snap.meta.documentTitle?.trim() || null;
  return { ok: true, payload, documentTitle: title };
}

function clampDocumentTitle(raw: string): string {
  const t = raw.trim();
  if (t.length <= SNAPSHOT_DOCUMENT_TITLE_MAX) return t || "Website";
  return t.slice(0, SNAPSHOT_DOCUMENT_TITLE_MAX);
}

export function applyPortalSectionPatches(
  payload: TailwindSectionsPayload,
  patches: { key: string; html: string }[],
  opts: { documentTitle?: string | null; existingDocumentTitle?: string | null },
): { ok: true; nextPayload: TailwindSectionsPayload; documentTitleOut: string } | { ok: false; error: string } {
  const next = cloneTailwindPayload(payload);

  for (const p of patches) {
    const parsed = parseKey(p.key);
    if (!parsed || !Number.isFinite(parsed.index) || parsed.index < 0) {
      return { ok: false, error: `Ongeldige sleutel: ${p.key}` };
    }
    // Structurele secties (navbar/header/footer/nav) worden nooit overschreven via de portal editor.
    // Door ze hier te skippen blijft de originele Alpine-wiring intact en wordt auto-nav-injectie voorkomen.
    if (/^<(header|footer|nav)\b/i.test(p.html.trimStart())) continue;
    const html = sanitizeTailwindFragment(p.html);
    if (!html.trim()) {
      return { ok: false, error: `Lege HTML na sanitization voor ${p.key}.` };
    }

    if (parsed.kind === "main") {
      if (parsed.index >= next.sections.length) {
        return { ok: false, error: `Ongeldige index voor main: ${parsed.index}` };
      }
      next.sections[parsed.index] = { ...next.sections[parsed.index], html };
      continue;
    }

    if (parsed.kind === "contact") {
      const arr = next.contactSections;
      if (!arr || parsed.index >= arr.length) {
        return { ok: false, error: `Ongeldige contact-sectie: ${p.key}` };
      }
      next.contactSections = [...arr];
      next.contactSections[parsed.index] = { ...next.contactSections[parsed.index], html };
      continue;
    }

    const page = parsed.page!;
    const pages = next.marketingPages;
    if (!pages || !pages[page] || parsed.index >= pages[page].length) {
      return { ok: false, error: `Ongeldige marketing-sectie: ${p.key}` };
    }
    const copy = { ...pages, [page]: [...pages[page]] };
    copy[page][parsed.index] = { ...copy[page][parsed.index], html };
    next.marketingPages = copy;
  }

  const fromInput = opts.documentTitle?.trim();
  const fromExisting = opts.existingDocumentTitle?.trim();
  const documentTitleOut = clampDocumentTitle(fromInput || fromExisting || "Website");

  return { ok: true, nextPayload: next, documentTitleOut };
}

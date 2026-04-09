import { z } from "zod";
import {
  sectionSemanticRoleSchema,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";

/** Eén gewijzigde sectie: alleen opnemen voor secties die echt HTML/metadata wijzigen. */
export const tailwindSectionUpdateSchema = z.object({
  index: z.number().int().min(0),
  html: z.string().min(1).max(120_000),
  sectionName: z.string().max(200).optional(),
  semanticRole: sectionSemanticRoleSchema.optional(),
  copyIntent: z.string().max(500).optional(),
});

export type TailwindSectionUpdate = z.infer<typeof tailwindSectionUpdateSchema>;

export function mergeTailwindSectionUpdates(
  sections: TailwindSection[],
  updates: TailwindSectionUpdate[],
): { ok: true; sections: TailwindSection[] } | { ok: false; error: string } {
  if (updates.length === 0) {
    return { ok: true, sections: sections.map((s) => ({ ...s })) };
  }

  const seen = new Set<number>();
  for (const u of updates) {
    if (u.index >= sections.length) {
      return {
        ok: false,
        error: `Claude gebruikte sectie-index ${u.index}; deze site heeft alleen index 0 t/m ${sections.length - 1}.`,
      };
    }
    if (seen.has(u.index)) {
      return {
        ok: false,
        error: `Dubbele sectie-index ${u.index} in het antwoord; elk gewijzigd blok hoort één keer voor te komen.`,
      };
    }
    seen.add(u.index);
  }

  const out: TailwindSection[] = sections.map((s) => ({ ...s }));
  for (const u of updates) {
    const prev = out[u.index]!;
    const row: TailwindSection = {
      sectionName: u.sectionName?.trim() || prev.sectionName,
      html: u.html,
    };
    const sr = u.semanticRole ?? prev.semanticRole;
    if (sr != null) row.semanticRole = sr;
    const ci = u.copyIntent ?? prev.copyIntent;
    if (ci != null) row.copyIntent = ci;
    out[u.index] = row;
  }
  return { ok: true, sections: out };
}

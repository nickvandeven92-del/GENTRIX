import {
  isLegacyTailwindPageConfig,
  legacyTailwindPageConfigSchema,
  masterPromptPageConfigSchema,
  tailwindPageConfigSchema,
  type LegacyTailwindPageConfig,
  type MasterPromptPageConfig,
  type TailwindPageConfig,
  type TailwindPageConfigPatch,
} from "@/lib/ai/tailwind-sections-schema";

export type PageConfigMergeStrategy = "deep_partial" | "variant_replace";

export type MergeTailwindPageConfigPatchResult =
  | { ok: true; value: TailwindPageConfig; strategy: PageConfigMergeStrategy; patchKeyCount: number }
  | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Objecten recursief mergen; arrays worden door de patch vervangen. */
export function deepMergeJson(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(patch)) return patch;
  if (!isPlainObject(base)) return patch;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const b = base[k];
    if (Array.isArray(v)) {
      out[k] = v;
    } else if (isPlainObject(v) && isPlainObject(b)) {
      out[k] = deepMergeJson(b, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Aantal ingevulde velden in de patch (recursief, voor metrics). */
export function countPatchKeys(patch: unknown, depth = 0): number {
  if (depth > 14 || patch === null || typeof patch !== "object") return 0;
  if (Array.isArray(patch)) {
    return patch.reduce((a, x) => a + countPatchKeys(x, depth + 1), 0);
  }
  return Object.entries(patch as Record<string, unknown>).reduce((sum, [, v]) => {
    if (v === undefined) return sum;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return sum + 1 + countPatchKeys(v, depth + 1);
    }
    return sum + 1;
  }, 0);
}

function isLegacyPatchShape(p: Record<string, unknown>): boolean {
  return (
    "themeName" in p ||
    "primaryColor" in p ||
    "fontFamily" in p ||
    "borderRadius" in p
  );
}

function isMasterPatchShape(p: Record<string, unknown>): boolean {
  return "style" in p || "theme" in p || ("font" in p && !("fontFamily" in p));
}

/**
 * Past een **gedeeltelijke** pageConfig-patch toe op de bestaande config.
 * Zelfde variant (legacy/legacy of master/master): subset / deep merge.
 * Andere variant: alleen als de patch op zich een **volledige** geldige `tailwindPageConfig` is (vervanging).
 */
export function mergeTailwindPageConfigPatch(
  base: TailwindPageConfig | undefined,
  patch: TailwindPageConfigPatch,
): MergeTailwindPageConfigPatchResult {
  const patchKeyCount = countPatchKeys(patch);
  const p = patch as Record<string, unknown>;

  if (isPlainObject(patch) && Object.keys(p).length === 0) {
    if (base === undefined) {
      return {
        ok: false,
        error:
          "theme.pageConfig: lege patch zonder bestaande pageConfig — geef een volledige config of laat pageConfig weg.",
      };
    }
    return { ok: true, value: structuredClone(base), strategy: "deep_partial", patchKeyCount: 0 };
  }

  if (base === undefined) {
    const full = tailwindPageConfigSchema.safeParse(patch);
    if (!full.success) {
      return {
        ok: false,
        error:
          "theme.pageConfig: geen bestaande pageConfig in snapshot — patch moet een **volledige** geldige pageConfig zijn.",
      };
    }
    return { ok: true, value: full.data, strategy: "variant_replace", patchKeyCount };
  }

  if (isLegacyTailwindPageConfig(base)) {
    if (isLegacyPatchShape(p) && !isMasterPatchShape(p)) {
      const merged: LegacyTailwindPageConfig = { ...base, ...(patch as LegacyTailwindPageConfig) };
      const r = legacyTailwindPageConfigSchema.safeParse(merged);
      if (!r.success) {
        return {
          ok: false,
          error: `theme.pageConfig (legacy merge): ${r.error.issues.map((i) => i.message).join("; ")}`,
        };
      }
      return { ok: true, value: r.data, strategy: "deep_partial", patchKeyCount };
    }
    const full = tailwindPageConfigSchema.safeParse(patch);
    if (full.success) {
      return { ok: true, value: full.data, strategy: "variant_replace", patchKeyCount };
    }
    return {
      ok: false,
      error:
        "theme.pageConfig: legacy-snapshot — gebruik legacy-velden (themeName, primaryColor, …) of een **volledige** nieuwe pageConfig; partial master-patch zonder volledig object wordt niet gemerged.",
    };
  }

  // --- master base ---
  if (isLegacyPatchShape(p) && !isMasterPatchShape(p)) {
    const full = tailwindPageConfigSchema.safeParse(patch);
    if (full.success) {
      return { ok: true, value: full.data, strategy: "variant_replace", patchKeyCount };
    }
    return {
      ok: false,
      error:
        "theme.pageConfig: master-snapshot — legacy-velden in patch zijn alleen toegestaan als de patch een volledige geldige pageConfig is.",
    };
  }

  if (!isMasterPatchShape(p)) {
    const full = tailwindPageConfigSchema.safeParse(patch);
    if (full.success) {
      return { ok: true, value: full.data, strategy: "variant_replace", patchKeyCount };
    }
    return { ok: false, error: "theme.pageConfig: geen herkenbare master- of legacy-patchvelden." };
  }

  const baseMaster = base as MasterPromptPageConfig;
  const merged: Record<string, unknown> = {
    style: p.style !== undefined ? p.style : baseMaster.style,
    font: p.font !== undefined ? p.font : baseMaster.font,
    theme:
      p.theme !== undefined && isPlainObject(p.theme)
        ? deepMergeJson(baseMaster.theme, p.theme)
        : baseMaster.theme,
  };

  const r = masterPromptPageConfigSchema.safeParse(merged);
  if (!r.success) {
    return {
      ok: false,
      error: `theme.pageConfig (master merge): ${r.error.issues.map((i) => i.message).join("; ")}`,
    };
  }
  return { ok: true, value: r.data, strategy: "deep_partial", patchKeyCount };
}

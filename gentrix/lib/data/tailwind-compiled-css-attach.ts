import type { TailwindSectionsPayload } from "@/lib/ai/tailwind-sections-schema";
import type { PublishedSitePayload } from "@/lib/site/project-published-payload";
import { buildTailwindCompiledCssBundle } from "@/lib/site/build-tailwind-compiled-css";
import { SNAPSHOT_TAILWIND_COMPILED_CSS_MAX } from "@/lib/site/project-snapshot-constants";

function projectRootDir(): string {
  return process.cwd();
}

/**
 * Bouwt Tailwind-CSS voor de huidige secties en plakt die op de payload. Bij fout → origineel (CDN-fallback).
 */
export async function attachCompiledTailwindCssToPayload(
  payload: TailwindSectionsPayload,
  documentTitle: string,
): Promise<TailwindSectionsPayload> {
  try {
    const css = await buildTailwindCompiledCssBundle({
      projectRoot: projectRootDir(),
      sections: payload.sections,
      pageConfig: payload.config ?? null,
      docTitle: documentTitle.trim() || "Website",
      customCss: payload.customCss,
      customJs: payload.customJs,
      logoSet: payload.logoSet ?? null,
    });
    const trimmed = css.trim();
    if (!trimmed) return payload;
    const capped =
      trimmed.length > SNAPSHOT_TAILWIND_COMPILED_CSS_MAX
        ? trimmed.slice(0, SNAPSHOT_TAILWIND_COMPILED_CSS_MAX)
        : trimmed;
    return { ...payload, tailwindCompiledCss: capped };
  } catch (e) {
    console.warn("[attachCompiledTailwindCssToPayload]", e instanceof Error ? e.message : e);
    return payload;
  }
}

/** Strikte `tailwind_sections`-shape voor de CLI-build (zelfde velden als snapshot → payload). */
export function tailwindSectionsPayloadFromPublishedTailwind(
  p: Extract<PublishedSitePayload, { kind: "tailwind" }>,
): TailwindSectionsPayload {
  return {
    format: "tailwind_sections",
    sections: p.sections,
    ...(p.config != null ? { config: p.config } : {}),
    ...(p.customCss != null && p.customCss !== "" ? { customCss: p.customCss } : {}),
    ...(p.customJs != null && p.customJs !== "" ? { customJs: p.customJs } : {}),
    ...(p.logoSet != null ? { logoSet: p.logoSet } : {}),
    ...(p.contactSections != null && p.contactSections.length > 0 ? { contactSections: p.contactSections } : {}),
    ...(p.marketingPages != null && Object.keys(p.marketingPages).length > 0
      ? { marketingPages: p.marketingPages }
      : {}),
  };
}

/**
 * Vult ontbrekende `tailwindCompiledCss` (oude snapshots / mislukte build bij opslag) zodat de iframe geen
 * Tailwind Play CDN laadt. Schrijft niet terug naar de database.
 */
export async function ensureTailwindCompiledCssOnPublishedPayload(
  payload: PublishedSitePayload,
  documentTitle: string,
): Promise<PublishedSitePayload> {
  if (payload.kind !== "tailwind") return payload;
  if (payload.tailwindCompiledCss != null && payload.tailwindCompiledCss.trim() !== "") return payload;
  const tw = tailwindSectionsPayloadFromPublishedTailwind(payload);
  const title = documentTitle.trim() || payload.clientName.trim() || "Website";
  const withCss = await attachCompiledTailwindCssToPayload(tw, title);
  const css = withCss.tailwindCompiledCss?.trim();
  if (!css) return payload;
  return { ...payload, tailwindCompiledCss: css };
}

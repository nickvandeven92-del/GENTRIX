import type { TailwindSectionsPayload } from "@/lib/ai/tailwind-sections-schema";
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

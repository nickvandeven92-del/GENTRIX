import type { TailwindSectionsPayload } from "@/lib/ai/tailwind-sections-schema";
import type { PublishedSitePayload } from "@/lib/site/project-published-payload";
import { tailwindSectionsPayloadFromPublishedTailwind } from "@/lib/data/tailwind-sections-payload-from-published";
import { buildTailwindCompiledCssBundle } from "@/lib/site/build-tailwind-compiled-css";
import { SNAPSHOT_TAILWIND_COMPILED_CSS_MAX } from "@/lib/site/project-snapshot-constants";

export { tailwindSectionsPayloadFromPublishedTailwind };

function projectRootDir(): string {
  return process.cwd();
}

/**
 * On-the-fly Tailwind CLI-build bij ontbrekende `tailwindCompiledCss` kan op serverless **lang** duren
 * en houdt `loading.tsx` vast. Na deze deadline: payload ongewijzigd → iframe valt terug op Play CDN.
 * Override: `PUBLISHED_SITE_TAILWIND_COMPILE_TIMEOUT_MS` (1000–55000), default 10000.
 */
function publishedSiteTailwindCompileBudgetMs(): number {
  const raw = process.env.PUBLISHED_SITE_TAILWIND_COMPILE_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : 10_000;
  if (!Number.isFinite(n)) return 10_000;
  return Math.min(55_000, Math.max(1_000, Math.floor(n)));
}

function raceWithTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => void): Promise<T | null> {
  if (ms <= 0) return promise.then((v) => v);
  let settled = false;
  return new Promise<T | null>((resolve) => {
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      onTimeout();
      resolve(null);
    }, ms);
    promise
      .then((v) => {
        clearTimeout(t);
        if (settled) return;
        settled = true;
        resolve(v);
      })
      .catch(() => {
        clearTimeout(t);
        if (settled) return;
        settled = true;
        resolve(null);
      });
  });
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
  const budget = publishedSiteTailwindCompileBudgetMs();
  const withCss = await raceWithTimeout(
    attachCompiledTailwindCssToPayload(tw, title),
    budget,
    () => {
      console.warn(
        `[ensureTailwindCompiledCssOnPublishedPayload] compile > ${budget}ms — skip (Tailwind Play CDN in viewer). Zet compiled CSS bij publish of verhoog PUBLISHED_SITE_TAILWIND_COMPILE_TIMEOUT_MS.`,
      );
    },
  );
  if (!withCss) return payload;
  const css = withCss.tailwindCompiledCss?.trim();
  if (!css) return payload;
  return { ...payload, tailwindCompiledCss: css };
}

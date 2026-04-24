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
 * On-the-fly Tailwind CLI-build bij ontbrekende `tailwindCompiledCss` kan op serverless **lang** duren.
 * Standaard **55s** (max); `compileBudgetMs: 0` wacht zonder timeout tot de CLI klaar is (publieke preview).
 * Override: `PUBLISHED_SITE_TAILWIND_COMPILE_TIMEOUT_MS` (1000–55000), alleen als geen expliciete budget-optie.
 */
function publishedSiteTailwindCompileBudgetMs(): number {
  const raw = process.env.PUBLISHED_SITE_TAILWIND_COMPILE_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : 55_000;
  if (!Number.isFinite(n)) return 55_000;
  return Math.min(55_000, Math.max(1_000, Math.floor(n)));
}

export type EnsureTailwindCompiledCssOptions = {
  /**
   * `0` = geen timeout (wacht op volledige CLI-build). Anders milliseconden cap (serverless‑vriendelijk).
   * Publieke `/site`‑preview gebruikt `0` zodat er geen Play CDN‑fallback nodig is.
   */
  compileBudgetMs?: number;
};

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
 * Eén extra poging na korte pauze als de eerste CLI-build leeg blijft (serverless/ephemeral FS-flakes).
 * Gebruikt door `ensureTailwindCompiledCssOnPublishedPayload` (budget 0) én door **persist/generator** zodat
 * snapshots zelden zonder `tailwindCompiledCss` in de DB landen.
 */
async function attachCompiledTailwindWithColdStartRetry(
  tw: TailwindSectionsPayload,
  title: string,
): Promise<TailwindSectionsPayload> {
  let out = await attachCompiledTailwindCssToPayload(tw, title);
  if (out.tailwindCompiledCss?.trim()) return out;
  await new Promise((r) => setTimeout(r, 220));
  out = await attachCompiledTailwindCssToPayload(tw, title);
  return out;
}

/** Zelfde dubbele compile-poging als het publieke `/site`-pad — aanroepen vóór snapshot naar Supabase. */
export async function attachCompiledTailwindCssToPayloadWithColdStartRetry(
  payload: TailwindSectionsPayload,
  documentTitle: string,
): Promise<TailwindSectionsPayload> {
  const title = documentTitle.trim() || "Website";
  return attachCompiledTailwindWithColdStartRetry(payload, title);
}

/**
 * Vult ontbrekende `tailwindCompiledCss` (oude snapshots / mislukte build bij opslag) zodat de preview geen
 * Tailwind Play CDN nodig heeft. Optioneel schrijft de caller CSS terug naar Supabase (`persistPublic…`).
 */
export async function ensureTailwindCompiledCssOnPublishedPayload(
  payload: PublishedSitePayload,
  documentTitle: string,
  options?: EnsureTailwindCompiledCssOptions,
): Promise<PublishedSitePayload> {
  if (payload.kind !== "tailwind") return payload;
  if (payload.tailwindCompiledCss != null && payload.tailwindCompiledCss.trim() !== "") return payload;
  const tw = tailwindSectionsPayloadFromPublishedTailwind(payload);
  const title = documentTitle.trim() || payload.clientName.trim() || "Website";
  const budgetOpt = options?.compileBudgetMs;
  const budget =
    budgetOpt === 0 ? 0 : budgetOpt != null && Number.isFinite(budgetOpt) ? Math.max(1_000, Math.floor(budgetOpt)) : publishedSiteTailwindCompileBudgetMs();

  const withCss =
    budget === 0
      ? await attachCompiledTailwindWithColdStartRetry(tw, title)
      : await raceWithTimeout(
          attachCompiledTailwindCssToPayload(tw, title),
          budget,
          () => {
            console.warn(
              `[ensureTailwindCompiledCssOnPublishedPayload] compile > ${budget}ms — skip (Tailwind Play CDN in viewer). Zet compiled CSS bij publish, of gebruik compileBudgetMs: 0 op het publieke pad.`,
            );
          },
        );
  if (!withCss) return payload;
  const css = withCss.tailwindCompiledCss?.trim();
  if (!css) return payload;
  return { ...payload, tailwindCompiledCss: css };
}

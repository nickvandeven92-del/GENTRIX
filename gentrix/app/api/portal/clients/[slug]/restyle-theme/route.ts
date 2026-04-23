import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import {
  tailwindPageConfigSchema,
  tailwindSectionSchema,
  tailwindSectionsPayloadSchema,
  type TailwindSectionsPayload,
} from "@/lib/ai/tailwind-sections-schema";
import {
  resolvePortalThemeTargetConfig,
  restyleSitePayloadToTheme,
  type PortalThemePresetId,
} from "@/lib/portal/restyle-site-theme";
import { persistTailwindDraftForExistingClient } from "@/lib/data/persist-tailwind-client-draft";
import { loadTailwindPayloadFromDraftJson } from "@/lib/portal/portal-draft-section-mutate";
import { getDraftSiteJsonBySlug } from "@/lib/data/client-draft-site";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { SNAPSHOT_DOCUMENT_TITLE_MAX } from "@/lib/site/project-snapshot-constants";
import {
  cachedToPayload,
  payloadToCached,
  readThemeVariantsCache,
  writeThemeVariantsCache,
  type CachedThemePayload,
  type ThemeVariantsCache,
} from "@/lib/portal/theme-variants-cache";

export const runtime = "nodejs";

const themeIdSchema = z.enum(["original", "dark", "warm"]);

// Voor de restyle accepteren we groter dan de studio-limiet van 24 — een volledige site
// met contact + marketing-pages kan makkelijk 30+ secties per array aantikken.
const sectionsArraySchema = z.array(tailwindSectionSchema).min(1).max(60);

const inlinePayloadSchema = z.object({
  config: tailwindPageConfigSchema,
  sections: sectionsArraySchema,
  contactSections: sectionsArraySchema.optional(),
  marketingPages: z.record(z.string().min(1).max(120), sectionsArraySchema).optional(),
  documentTitle: z.string().min(1).max(SNAPSHOT_DOCUMENT_TITLE_MAX).optional(),
});

const bodySchema = z.object({
  themeId: themeIdSchema,
  /** Momentele draft-state uit de editor (incl. evt. lokale edits die nog niet gesaved zijn). */
  payload: inlinePayloadSchema,
});

type RouteContext = { params: Promise<{ slug: string }> };

type ClientRow = {
  id: string;
  name: string;
  description: string | null;
  subfolder_slug: string;
  status: string;
  draft_snapshot_id: string | null;
  generation_package?: string | null;
};

function toStrictTailwindPayload(input: {
  config: CachedThemePayload["config"];
  sections: CachedThemePayload["sections"];
  contactSections?: CachedThemePayload["contactSections"];
  marketingPages?: CachedThemePayload["marketingPages"];
}) {
  return tailwindSectionsPayloadSchema.safeParse({
    format: "tailwind_sections",
    config: input.config,
    sections: input.sections,
    ...(input.contactSections ? { contactSections: input.contactSections } : {}),
    ...(input.marketingPages ? { marketingPages: input.marketingPages } : {}),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  // Rate-limit is strenger dan save/draft-sections: elke restyle kan een dure Claude-run zijn.
  if (!checkPortalRateLimit(access.userId, `portal:restyletheme:${slug}`, 8)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" ") },
      { status: 400 },
    );
  }

  const { themeId, payload } = parsed.data;
  const themeIdTyped = themeId as PortalThemePresetId;

  const supabase = createServiceRoleClient();
  const q = await supabase
    .from("clients")
    .select("id, name, description, subfolder_slug, status, draft_snapshot_id, generation_package")
    .eq("subfolder_slug", slug)
    .maybeSingle();

  let row: ClientRow | null = null;
  if (q.error && isPostgrestUnknownColumnError(q.error, "draft_snapshot_id")) {
    const second = await supabase
      .from("clients")
      .select("id, name, description, subfolder_slug, status, generation_package")
      .eq("subfolder_slug", slug)
      .maybeSingle();
    if (second.error || !second.data) {
      return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
    }
    row = { ...(second.data as Omit<ClientRow, "draft_snapshot_id">), draft_snapshot_id: null };
  } else if (q.error || !q.data) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  } else {
    row = q.data as ClientRow;
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }
  const clientRow = row;

  // ---------------------------------------------------------------------------
  // 1) Cache laden. Wanneer de kolom nog niet bestaat (pre-migration) vallen we door naar het
  //    oude "altijd AI"-pad. In dat fallback-geval kunnen we geen "Origineel" reconstrueren.
  // ---------------------------------------------------------------------------
  const cacheRead = await readThemeVariantsCache(supabase, clientRow.id);
  const cacheSupported = cacheRead.supported;
  let cache: ThemeVariantsCache = cacheSupported ? cacheRead.cache : { variants: {} };

  // ---------------------------------------------------------------------------
  // 2) Originele baseline lazy-capturen wanneer dat nog niet is gebeurd. We gebruiken de
  //    **huidige draft uit de DB** als baseline — niet de incoming `payload` — omdat de client
  //    lokaal al een thema-restyle in-memory kan hebben toegepast via een eerdere call. De DB
  //    is de bron van de waarheid: v??r de allereerste restyle-call is dat altijd de originele
  //    site zoals-gegenereerd.
  // ---------------------------------------------------------------------------
  if (cacheSupported && !cache.variants.original) {
    const dbJson = await getDraftSiteJsonBySlug(slug);
    const dbLoaded = dbJson ? loadTailwindPayloadFromDraftJson(dbJson) : { ok: false as const, error: "Geen draft." };
    if (dbLoaded.ok) {
      cache = {
        ...cache,
        active: cache.active ?? "original",
        variants: {
          ...cache.variants,
          original: payloadToCached(dbLoaded.payload, dbLoaded.documentTitle ?? undefined),
        },
      };
      // Direct wegschrijven zodat een crash in de volgende stappen de baseline niet verliest.
      await writeThemeVariantsCache(supabase, clientRow.id, cache);
    }
  }

  // ---------------------------------------------------------------------------
  // 3) Cache-hit: hergebruik een eerder opgeslagen variant zonder AI-call.
  // ---------------------------------------------------------------------------
  const cachedTarget = cacheSupported ? cache.variants[themeIdTyped] : undefined;
  if (cachedTarget) {
    const strict = toStrictTailwindPayload(cachedTarget);
    if (strict.success) {
      const docTitle = (cachedTarget.documentTitle ?? payload.documentTitle ?? clientRow.name ?? "Website").trim();
      const label =
        themeIdTyped === "original"
          ? "Portaal — thema: Origineel (cache)"
          : themeIdTyped === "dark"
            ? "Portaal — thema: Donker (cache)"
            : "Portaal — thema: Warm (cache)";
      const persist = await persistTailwindDraftForExistingClient(supabase, clientRow, strict.data, {
        snapshotSource: "editor",
        snapshotLabel: label,
        snapshotNotes: `portal_user=${access.userId} theme=${themeIdTyped} source=cache`,
        documentTitle: docTitle,
      });
      if (!persist.ok) {
        return NextResponse.json({ ok: false, error: persist.error }, { status: persist.status });
      }

      if (cacheSupported) {
        await writeThemeVariantsCache(supabase, clientRow.id, { ...cache, active: themeIdTyped });
      }

      revalidatePath(`/portal/${encodeURIComponent(slug)}/website`);

      const freshJson = await getDraftSiteJsonBySlug(slug);
      const fresh = freshJson ? loadTailwindPayloadFromDraftJson(freshJson) : { ok: false as const, error: "Geen draft." };

      return NextResponse.json({
        ok: true,
        data: {
          snapshot_id: persist.snapshot_id,
          documentTitle: docTitle,
          fromCache: true,
          payload: fresh.ok
            ? {
                config: fresh.payload.config ?? cachedTarget.config,
                sections: fresh.payload.sections,
                ...(fresh.payload.contactSections ? { contactSections: fresh.payload.contactSections } : {}),
                ...(fresh.payload.marketingPages ? { marketingPages: fresh.payload.marketingPages } : {}),
              }
            : {
                config: cachedTarget.config,
                sections: cachedTarget.sections,
                ...(cachedTarget.contactSections ? { contactSections: cachedTarget.contactSections } : {}),
                ...(cachedTarget.marketingPages ? { marketingPages: cachedTarget.marketingPages } : {}),
              },
        },
      });
    }
    // Corrupte cache-ingang: stille cleanup en doorval naar herberekening.
    delete cache.variants[themeIdTyped];
  }

  // ---------------------------------------------------------------------------
  // 4) Cache-miss pad.
  // ---------------------------------------------------------------------------

  // Origineel zonder cache-hit: vangnet. Zonder eerdere baseline is de "incoming" payload alles
  // wat we hebben ??? we slaan hem op als original-cache zodat een toekomstige click w??l werkt.
  if (themeIdTyped === "original") {
    const strictPayload = toStrictTailwindPayload(payload);
    if (!strictPayload.success) {
      return NextResponse.json(
        { ok: false, error: `Origineel-payload ongeldig: ${strictPayload.error.issues[0]?.message ?? "onbekend"}` },
        { status: 422 },
      );
    }

    const docTitle = (payload.documentTitle ?? clientRow.name ?? "Website").trim();
    const persist = await persistTailwindDraftForExistingClient(supabase, clientRow, strictPayload.data, {
      snapshotSource: "editor",
      snapshotLabel: "Portaal — thema: Origineel",
      snapshotNotes: `portal_user=${access.userId} theme=original source=payload`,
      documentTitle: docTitle,
    });
    if (!persist.ok) {
      return NextResponse.json({ ok: false, error: persist.error }, { status: persist.status });
    }

    if (cacheSupported) {
      await writeThemeVariantsCache(supabase, clientRow.id, {
        active: "original",
        variants: {
          ...cache.variants,
          original: payloadToCached(strictPayload.data, docTitle),
        },
      });
    }

    revalidatePath(`/portal/${encodeURIComponent(slug)}/website`);

    return NextResponse.json({
      ok: true,
      data: {
        snapshot_id: persist.snapshot_id,
        documentTitle: docTitle,
        fromCache: false,
        payload: {
          config: strictPayload.data.config,
          sections: strictPayload.data.sections,
          ...(strictPayload.data.contactSections ? { contactSections: strictPayload.data.contactSections } : {}),
          ...(strictPayload.data.marketingPages ? { marketingPages: strictPayload.data.marketingPages } : {}),
        },
      },
    });
  }

  // Dark / Warm: kies de baseline voor de AI-restyle. **Altijd** vanuit Origineel (NIET vanaf een
  // eerder getransformeerde variant), zodat Donker ? Warm niet compound.
  const baselineForAi: TailwindSectionsPayload =
    cacheSupported && cache.variants.original
      ? cachedToPayload(cache.variants.original)
      : ({
          format: "tailwind_sections",
          config: payload.config,
          sections: payload.sections,
          ...(payload.contactSections ? { contactSections: payload.contactSections } : {}),
          ...(payload.marketingPages ? { marketingPages: payload.marketingPages } : {}),
        } as TailwindSectionsPayload);

  if (!baselineForAi.config) {
    return NextResponse.json(
      { ok: false, error: "Baseline pageConfig ontbreekt; thema kan niet worden afgeleid." },
      { status: 422 },
    );
  }
  const targetConfig = resolvePortalThemeTargetConfig(baselineForAi.config, themeIdTyped);
  if (!targetConfig) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Thema-presets werken alleen voor sites met een master-format pageConfig. Laat deze site via de studio hermigreren.",
      },
      { status: 422 },
    );
  }

  try {
    const restyled = await restyleSitePayloadToTheme({ payload: baselineForAi, targetConfig });

    if (!restyled.ok) {
      return NextResponse.json(
        { ok: false, error: restyled.error },
        { status: restyled.status ?? 502 },
      );
    }

    const restyledStrict = tailwindSectionsPayloadSchema.safeParse({
      format: "tailwind_sections",
      config: restyled.payload.config,
      sections: restyled.payload.sections,
      ...(restyled.payload.contactSections ? { contactSections: restyled.payload.contactSections } : {}),
      ...(restyled.payload.marketingPages ? { marketingPages: restyled.payload.marketingPages } : {}),
    });
    if (!restyledStrict.success) {
      return NextResponse.json(
        {
          ok: false,
          error: `Restyle leverde een ongeldige payload: ${restyledStrict.error.issues[0]?.message ?? "onbekend"}`,
        },
        { status: 502 },
      );
    }

    const docTitle = (payload.documentTitle ?? clientRow.name ?? "Website").trim();
    const label = themeIdTyped === "dark" ? "Portaal — thema: Donker" : "Portaal — thema: Warm";

    const persist = await persistTailwindDraftForExistingClient(supabase, clientRow, restyledStrict.data, {
      snapshotSource: "editor",
      snapshotLabel: label,
      snapshotNotes: `portal_user=${access.userId} theme=${themeIdTyped} source=ai`,
      documentTitle: docTitle,
    });

    if (!persist.ok) {
      return NextResponse.json({ ok: false, error: persist.error }, { status: persist.status });
    }

    if (cacheSupported) {
      await writeThemeVariantsCache(supabase, clientRow.id, {
        ...cache,
        active: themeIdTyped,
        variants: {
          ...cache.variants,
          [themeIdTyped]: payloadToCached(restyledStrict.data, docTitle),
        },
      });
    }

    revalidatePath(`/portal/${encodeURIComponent(slug)}/website`);

    const freshJson = await getDraftSiteJsonBySlug(slug);
    const fresh = freshJson ? loadTailwindPayloadFromDraftJson(freshJson) : { ok: false as const, error: "Geen draft." };

    return NextResponse.json({
      ok: true,
      data: {
        snapshot_id: persist.snapshot_id,
        documentTitle: docTitle,
        fromCache: false,
        payload: fresh.ok
          ? {
              config: fresh.payload.config ?? targetConfig,
              sections: fresh.payload.sections,
              ...(fresh.payload.contactSections ? { contactSections: fresh.payload.contactSections } : {}),
              ...(fresh.payload.marketingPages ? { marketingPages: fresh.payload.marketingPages } : {}),
            }
          : {
              config: targetConfig,
              sections: restyled.payload.sections,
              ...(restyled.payload.contactSections ? { contactSections: restyled.payload.contactSections } : {}),
              ...(restyled.payload.marketingPages ? { marketingPages: restyled.payload.marketingPages } : {}),
            },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout bij Claude.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

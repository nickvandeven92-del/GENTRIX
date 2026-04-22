import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import {
  tailwindPageConfigSchema,
  tailwindSectionSchema,
  tailwindSectionsPayloadSchema,
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
  payload: inlinePayloadSchema,
  /** Meegezonden wanneer de gebruiker op "Origineel" klikt: de bij page-load vastgelegde baseline. */
  originalPayload: inlinePayloadSchema.optional(),
});

type RouteContext = { params: Promise<{ slug: string }> };

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

  // Rate-limit is strenger dan save/draft-sections: elke restyle is een dure Claude-run.
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

  const { themeId, payload, originalPayload } = parsed.data;
  const themeIdTyped = themeId as PortalThemePresetId;

  // Haal de klant-row op — nodig voor persistentie.
  const supabase = createServiceRoleClient();
  const q = await supabase
    .from("clients")
    .select("id, name, description, subfolder_slug, status, draft_snapshot_id, generation_package")
    .eq("subfolder_slug", slug)
    .maybeSingle();

  type ClientRow = {
    id: string;
    name: string;
    description: string | null;
    subfolder_slug: string;
    status: string;
    draft_snapshot_id: string | null;
    generation_package?: string | null;
  };

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

  // Voor Origineel: gebruik de mount-time baseline als die is meegestuurd; anders de huidige payload
  // (effectief een no-op die enkel de theme-status synchroniseert).
  if (themeId === "original") {
    const base = originalPayload ?? payload;
    const originalStrict = tailwindSectionsPayloadSchema.safeParse({
      format: "tailwind_sections",
      config: base.config,
      sections: base.sections,
      ...(base.contactSections ? { contactSections: base.contactSections } : {}),
      ...(base.marketingPages ? { marketingPages: base.marketingPages } : {}),
    });
    if (!originalStrict.success) {
      return NextResponse.json(
        { ok: false, error: `Origineel-payload ongeldig: ${originalStrict.error.issues[0]?.message ?? "onbekend"}` },
        { status: 422 },
      );
    }

    const docTitle = (base.documentTitle ?? payload.documentTitle ?? row.name ?? "Website").trim();
    const persist = await persistTailwindDraftForExistingClient(supabase, row, originalStrict.data, {
      snapshotSource: "editor",
      snapshotLabel: "Portaal — thema: Origineel",
      snapshotNotes: `portal_user=${access.userId} theme=original`,
      documentTitle: docTitle,
    });

    if (!persist.ok) {
      return NextResponse.json({ ok: false, error: persist.error }, { status: persist.status });
    }

    // Laad het daadwerkelijk-opgeslagen snapshot terug zodat de client 1-op-1 synchroon blijft met de DB.
    const freshJson = await getDraftSiteJsonBySlug(slug);
    const fresh = freshJson ? loadTailwindPayloadFromDraftJson(freshJson) : { ok: false as const, error: "Geen draft." };

    revalidatePath(`/portal/${encodeURIComponent(slug)}/website`);

    return NextResponse.json({
      ok: true,
      data: {
        snapshot_id: persist.snapshot_id,
        documentTitle: docTitle,
        payload: fresh.ok
          ? {
              config: fresh.payload.config ?? base.config,
              sections: fresh.payload.sections,
              ...(fresh.payload.contactSections ? { contactSections: fresh.payload.contactSections } : {}),
              ...(fresh.payload.marketingPages ? { marketingPages: fresh.payload.marketingPages } : {}),
            }
          : {
              config: base.config,
              sections: base.sections,
              ...(base.contactSections ? { contactSections: base.contactSections } : {}),
              ...(base.marketingPages ? { marketingPages: base.marketingPages } : {}),
            },
      },
    });
  }

  // Dark / Warm: bepaal het doel-palet op basis van de huidige config en laat Claude de HTML herkleuren.
  const targetConfig = resolvePortalThemeTargetConfig(payload.config, themeIdTyped);
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
    const restyled = await restyleSitePayloadToTheme({
      payload: {
        format: "tailwind_sections",
        config: payload.config,
        sections: payload.sections,
        ...(payload.contactSections ? { contactSections: payload.contactSections } : {}),
        ...(payload.marketingPages ? { marketingPages: payload.marketingPages } : {}),
      },
      targetConfig,
    });

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

    const docTitle = (payload.documentTitle ?? row.name ?? "Website").trim();
    const label = themeIdTyped === "dark" ? "Portaal — thema: Donker" : "Portaal — thema: Warm";

    const persist = await persistTailwindDraftForExistingClient(supabase, row, restyledStrict.data, {
      snapshotSource: "editor",
      snapshotLabel: label,
      snapshotNotes: `portal_user=${access.userId} theme=${themeIdTyped}`,
      documentTitle: docTitle,
    });

    if (!persist.ok) {
      return NextResponse.json({ ok: false, error: persist.error }, { status: persist.status });
    }

    const freshJson = await getDraftSiteJsonBySlug(slug);
    const fresh = freshJson ? loadTailwindPayloadFromDraftJson(freshJson) : { ok: false as const, error: "Geen draft." };

    revalidatePath(`/portal/${encodeURIComponent(slug)}/website`);

    return NextResponse.json({
      ok: true,
      data: {
        snapshot_id: persist.snapshot_id,
        documentTitle: docTitle,
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

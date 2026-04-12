import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { getDraftSiteJsonBySlug } from "@/lib/data/client-draft-site";
import { persistTailwindDraftForExistingClient } from "@/lib/data/persist-tailwind-client-draft";
import {
  applyPortalSectionPatches,
  listPortalDraftSectionRows,
  loadTailwindPayloadFromDraftJson,
} from "@/lib/portal/portal-draft-section-mutate";
import { tailwindSectionsPayloadSchema } from "@/lib/ai/tailwind-sections-schema";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { SNAPSHOT_DOCUMENT_TITLE_MAX } from "@/lib/site/project-snapshot-constants";

const patchBodySchema = z.object({
  documentTitle: z.string().min(1).max(SNAPSHOT_DOCUMENT_TITLE_MAX).optional(),
  patches: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        html: z.string().min(1).max(120_000),
      }),
    )
    .min(1)
    .max(24),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  if (!checkPortalRateLimit(access.userId, `portal:draftsec:get:${slug}`, 90)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const draftJson = await getDraftSiteJsonBySlug(slug);
  if (!draftJson) {
    return NextResponse.json({ ok: false, error: "Geen concept-data." }, { status: 404 });
  }

  const loaded = loadTailwindPayloadFromDraftJson(draftJson);
  if (!loaded.ok) {
    return NextResponse.json(
      { ok: false, error: "Alleen tailwind/project-snapshot sites zijn hier bewerkbaar.", detail: loaded.error },
      { status: 422 },
    );
  }

  const rows = listPortalDraftSectionRows(loaded.payload);
  return NextResponse.json({
    ok: true,
    data: {
      documentTitle: loaded.documentTitle,
      sections: rows.map((r) => ({ key: r.key, sectionName: r.sectionName, html: r.html })),
    },
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

  if (!checkPortalRateLimit(access.userId, `portal:draftsec:post:${slug}`, 30)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ongeldige body." }, { status: 400 });
  }

  const draftJson = await getDraftSiteJsonBySlug(slug);
  if (!draftJson) {
    return NextResponse.json({ ok: false, error: "Geen concept-data." }, { status: 404 });
  }

  const loaded = loadTailwindPayloadFromDraftJson(draftJson);
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, error: loaded.error }, { status: 422 });
  }

  const applied = applyPortalSectionPatches(loaded.payload, parsed.data.patches, {
    documentTitle: parsed.data.documentTitle,
    existingDocumentTitle: loaded.documentTitle,
  });
  if (!applied.ok) {
    return NextResponse.json({ ok: false, error: applied.error }, { status: 400 });
  }

  let strictPayload;
  try {
    strictPayload = tailwindSectionsPayloadSchema.parse(applied.nextPayload);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Payload-validatie mislukt." },
      { status: 422 },
    );
  }

  const supabase = createServiceRoleClient();
  const q = await supabase
    .from("clients")
    .select("id, name, description, subfolder_slug, status, draft_snapshot_id, generation_package")
    .eq("subfolder_slug", slug)
    .maybeSingle();

  type PersistRow = {
    id: string;
    name: string;
    description: string | null;
    subfolder_slug: string;
    status: string;
    draft_snapshot_id: string | null;
    generation_package?: string | null;
  };

  let row: PersistRow | null = null;

  if (q.error && isPostgrestUnknownColumnError(q.error, "draft_snapshot_id")) {
    const second = await supabase
      .from("clients")
      .select("id, name, description, subfolder_slug, status, generation_package")
      .eq("subfolder_slug", slug)
      .maybeSingle();
    if (second.error || !second.data) {
      return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
    }
    row = { ...(second.data as Omit<PersistRow, "draft_snapshot_id">), draft_snapshot_id: null };
  } else if (q.error || !q.data) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  } else {
    row = q.data as PersistRow;
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const persist = await persistTailwindDraftForExistingClient(supabase, row, strictPayload, {
    snapshotSource: "editor",
    snapshotLabel: "Portaal — tekst/HTML",
    snapshotNotes: `portal_user=${access.userId}`,
    documentTitle: applied.documentTitleOut,
  });

  if (!persist.ok) {
    return NextResponse.json({ ok: false, error: persist.error }, { status: persist.status });
  }

  return NextResponse.json({
    ok: true,
    data: {
      snapshot_id: persist.snapshot_id,
      documentTitle: applied.documentTitleOut,
    },
  });
}

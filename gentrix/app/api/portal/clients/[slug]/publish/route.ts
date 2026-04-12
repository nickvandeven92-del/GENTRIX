import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { publishClientSnapshotForSlug } from "@/lib/data/publish-client-snapshot";
import { isValidSubfolderSlug } from "@/lib/slug";

const bodySchema = z.object({ snapshot_id: z.string().uuid().optional() }).optional();

type RouteContext = { params: Promise<{ slug: string }> };

/** Klant zet zichtbare live-inhoud op de huidige (of gekozen) snapshot — zelfde kern als admin-publish. */
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

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ongeldige body." }, { status: 400 });
  }

  const result = await publishClientSnapshotForSlug(slug, parsed.data?.snapshot_id ?? null);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    data: {
      published_snapshot_id: result.published_snapshot_id,
      is_publicly_visible: result.is_publicly_visible,
      visibility_hint: result.visibility_hint,
    },
  });
}

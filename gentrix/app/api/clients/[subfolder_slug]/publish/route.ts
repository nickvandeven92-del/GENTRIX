import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { publishClientSnapshotForSlug } from "@/lib/data/publish-client-snapshot";
import { publishedSiteTag } from "@/lib/data/get-published-site";
import { isValidSubfolderSlug } from "@/lib/slug";

const bodySchema = z.object({ snapshot_id: z.string().uuid().optional() }).optional();

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

/**
 * Fase 3: zet de **live** site op een bestaande snapshot (standaard = huidige concept).
 * Wijzigt niet `clients.status`; publieke URL vereist nog steeds `active`.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
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

  const result = await publishClientSnapshotForSlug(subfolder_slug, parsed.data?.snapshot_id ?? null);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  revalidateTag(publishedSiteTag(subfolder_slug));
  revalidateTag("published-site");
  revalidatePath(`/site/${subfolder_slug}`);

  return NextResponse.json({
    ok: true,
    data: {
      published_snapshot_id: result.published_snapshot_id,
      is_publicly_visible: result.is_publicly_visible,
      visibility_hint: result.visibility_hint,
    },
  });
}

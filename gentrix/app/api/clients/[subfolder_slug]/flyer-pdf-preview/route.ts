import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { ensureClientFlyerPublicTokenBySlug } from "@/lib/data/ensure-client-flyer-token";
import { buildClientFlyerPdf } from "@/lib/flyer/build-client-flyer-pdf";
import { flyerStudioPersistedSchema } from "@/lib/flyer/flyer-studio-schema";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import { getRequestOrigin } from "@/lib/site/request-origin";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

const bodySchema = z
  .object({
    studio: flyerStudioPersistedSchema,
    template: z.enum(["minimal", "modern", "gentrix"]),
  })
  .strict();

/** Admin: genereer PDF in het geheugen op basis van (nog niet opgeslagen) Flyerstudio-state — voor live preview. */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON-body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase.from("clients").select("name").eq("subfolder_slug", slug).maybeSingle();
  if (error || !row) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const token = await ensureClientFlyerPublicTokenBySlug(slug);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Flyer-token ontbreekt (migratie flyer_public_token?)." },
      { status: 503 },
    );
  }

  const origin = ((await getRequestOrigin()) || getPublicAppUrl()).replace(/\/$/, "");
  const flyerPageUrl = `${origin}/p/${encodeURIComponent(token)}`;
  const displayName = String((row as { name?: string }).name ?? "").trim() || slug;

  const bytes = await buildClientFlyerPdf({
    template: parsed.data.template,
    clientDisplayName: displayName,
    flyerPageUrl,
    studio: parsed.data.studio,
  });

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
    },
  });
}

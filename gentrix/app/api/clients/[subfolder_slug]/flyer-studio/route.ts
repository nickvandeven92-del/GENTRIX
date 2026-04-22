import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { flyerStudioPersistedSchema } from "@/lib/flyer/flyer-studio-schema";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidSubfolderSlug } from "@/lib/slug";
import type { Json } from "@/lib/types/database";

export const maxDuration = 30;

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

const bodySchema = z
  .object({
    studio: flyerStudioPersistedSchema,
  })
  .strict();

/** Admin: sla Flyerstudio (teksten + presets) op in `clients.flyer_studio_json`. */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStudioAdminApiAuth();
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
  const { data: exists, error: exErr } = await supabase.from("clients").select("id").eq("subfolder_slug", slug).maybeSingle();
  if (exErr || !exists) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const { error } = await supabase
    .from("clients")
    .update({
      flyer_studio_json: parsed.data.studio as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("subfolder_slug", slug);

  if (error && isPostgrestUnknownColumnError(error, "flyer_studio_json")) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Kolom flyer_studio_json ontbreekt. Voer de migratie 20260414120000_clients_flyer_studio_json.sql uit op Supabase.",
      },
      { status: 503 },
    );
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

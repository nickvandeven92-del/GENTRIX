import { NextResponse } from "next/server";
import { z } from "zod";
import { actorDisplayLabel } from "@/lib/auth/actor-display-label";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

const postBodySchema = z.object({
  body: z.string().trim().min(1, "Notitie mag niet leeg zijn.").max(8000, "Maximaal 8000 tekens."),
});

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);

  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const client = await getAdminClientBySlug(subfolder_slug);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_dossier_notes")
    .insert({
      client_id: client.id,
      body: parsed.data.body,
      created_by: auth.userId,
      created_by_label: actorDisplayLabel(auth.userId, auth.email),
    })
    .select("id, client_id, body, created_by, created_by_label, created_at")
    .single();

  if (error) {
    const msg = error.message ?? "Opslaan mislukt.";
    if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("schema cache")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "De notitietabel ontbreekt nog. Voer de migratie uit: supabase db push of voer het SQL-bestand handmatig uit in Supabase.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, note: data });
}

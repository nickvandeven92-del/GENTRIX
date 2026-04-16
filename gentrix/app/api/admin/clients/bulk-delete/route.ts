import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { isValidSubfolderSlug, STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const bodySchema = z.object({
  subfolder_slugs: z.array(z.string()).max(100),
});

function normalizeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Maximaal 100 slugs per verzoek." }, { status: 400 });
  }

  const seen = new Set<string>();
  const reserved: string[] = [];
  const invalid: string[] = [];
  const valid: string[] = [];

  for (const raw of parsed.data.subfolder_slugs) {
    const s = normalizeSlug(raw);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    if (s === STUDIO_HOMEPAGE_SUBFOLDER_SLUG) {
      reserved.push(s);
      continue;
    }
    if (!isValidSubfolderSlug(s)) {
      invalid.push(raw);
      continue;
    }
    valid.push(s);
  }

  if (valid.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          reserved.length || invalid.length
            ? "Geen verwijderbare slugs (ongeldig of gereserveerd, bijv. studio-homepage)."
            : "Geen slugs opgegeven.",
        ignored: { reserved, invalid },
      },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .delete()
      .in("subfolder_slug", valid)
      .select("subfolder_slug");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const deleted_slugs = (data ?? []).map((r) => r.subfolder_slug as string);

    return NextResponse.json({
      ok: true,
      deleted_slugs,
      ignored: { reserved, invalid },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt in .env.local (server-only)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

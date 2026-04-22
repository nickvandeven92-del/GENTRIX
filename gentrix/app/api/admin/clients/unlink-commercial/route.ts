import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
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

type RpcResult = {
  ok?: boolean;
  error?: string;
  subfolder_slug?: string;
  already_unlinked?: boolean;
};

export async function POST(request: Request) {
  const auth = await requireStudioAdminApiAuth();
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
            ? "Geen bruikbare slugs (ongeldig of gereserveerd, bijv. studio-homepage)."
            : "Geen slugs opgegeven.",
        ignored: { reserved, invalid },
      },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const results: { subfolder_slug: string; already_unlinked?: boolean }[] = [];
    const failures: { subfolder_slug: string; error: string }[] = [];

    for (const slug of valid) {
      const { data, error } = await supabase.rpc("unlink_client_commercial_keep_site", {
        p_subfolder_slug: slug,
      });

      if (error) {
        if (error.message.toLowerCase().includes("unlink_client_commercial_keep_site")) {
          failures.push({
            subfolder_slug: slug,
            error:
              "Databasefunctie ontbreekt. Voer migratie 20260423120000_clients_commercial_unlink.sql uit (Supabase SQL Editor of db push).",
          });
        } else {
          failures.push({ subfolder_slug: slug, error: error.message });
        }
        continue;
      }

      const row = data as RpcResult | null;
      if (!row || row.ok === false) {
        failures.push({
          subfolder_slug: slug,
          error: row?.error === "not_found" ? "Niet gevonden." : (row?.error ?? "RPC mislukt."),
        });
        continue;
      }

      results.push({
        subfolder_slug: row.subfolder_slug ?? slug,
        already_unlinked: row.already_unlinked === true,
      });
    }

    return NextResponse.json({
      ok: failures.length === 0,
      unlinked: results,
      failures,
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

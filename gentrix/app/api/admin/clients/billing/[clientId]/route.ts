import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

type Ctx = { params: Promise<{ clientId: string }> };

const FULL_SELECT =
  "id, name, company_legal_name, contact_name, billing_email, phone, billing_address, billing_postal_code, billing_city, vat_number";

const FALLBACK_SELECT =
  "id, name, company_legal_name, billing_email, phone, billing_address, vat_number";

/** Facturatiegegevens voor offerte/factuur-formulieren (snapshot-bron). */
export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const { clientId } = await ctx.params;
  const supabase = createServiceRoleClient();

  let { data, error } = await supabase.from("clients").select(FULL_SELECT).eq("id", clientId).maybeSingle();

  if (error && isPostgrestUnknownColumnError(error, "contact_name")) {
    const second = await supabase.from("clients").select(FALLBACK_SELECT).eq("id", clientId).maybeSingle();
    data = second.data
      ? {
          ...second.data,
          contact_name: null,
          billing_postal_code: null,
          billing_city: null,
        }
      : null;
    error = second.error;
  }

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data });
}

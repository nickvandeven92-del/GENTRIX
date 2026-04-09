import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { createQuoteBodySchema } from "@/lib/commercial/billing-api-schemas";
import { generateQuoteNumber } from "@/lib/commercial/document-numbering";
import {
  clientSnapshotsFromRow,
  mapLineInputsToRows,
  totalFromLineRows,
} from "@/lib/commercial/billing-insert-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const LIST_SELECT =
  "id, client_id, deal_id, quote_number, amount, status, valid_until, issued_at, sent_at, created_at, clients(name, client_number)";

export async function GET() {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("quotes").select(LIST_SELECT).order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: data ?? [] });
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
  const parsed = createQuoteBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const p = parsed.data;
  const supabase = createServiceRoleClient();

  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .select("name, company_legal_name, contact_name, billing_email, phone, billing_address, billing_postal_code, billing_city")
    .eq("id", p.client_id)
    .single();

  if (clientErr || !clientRow) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 400 });
  }

  const cr = clientRow as Record<string, unknown>;
  const snapshots = clientSnapshotsFromRow({
    name: String(cr.name ?? ""),
    company_legal_name: (cr.company_legal_name as string | null) ?? null,
    contact_name: (cr.contact_name as string | null) ?? null,
    billing_email: (cr.billing_email as string | null) ?? null,
    phone: (cr.phone as string | null) ?? null,
    billing_address: (cr.billing_address as string | null) ?? null,
    billing_postal_code: (cr.billing_postal_code as string | null) ?? null,
    billing_city: (cr.billing_city as string | null) ?? null,
  });
  const lineRows = mapLineInputsToRows(p.items);
  const total = totalFromLineRows(lineRows);
  const nowIso = new Date().toISOString();
  const issuedAt =
    p.issued_at && typeof p.issued_at === "string" && p.issued_at.trim().length > 0
      ? new Date(p.issued_at).toISOString()
      : nowIso;

  let quoteNumber: string;
  try {
    quoteNumber = await generateQuoteNumber(supabase);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Nummer genereren mislukt." }, { status: 500 });
  }

  const insertRow = {
    client_id: p.client_id,
    deal_id: p.deal_id ?? null,
    quote_number: quoteNumber,
    amount: total,
    valid_until: p.valid_until,
    status: p.status,
    currency: "EUR",
    notes: p.notes ?? null,
    title: p.title ?? null,
    intro_text: p.intro_text ?? null,
    scope_text: p.scope_text ?? null,
    delivery_text: p.delivery_text ?? null,
    exclusions_text: p.exclusions_text ?? null,
    terms_text: p.terms_text ?? null,
    issued_at: issuedAt,
    sent_at: p.status === "sent" ? nowIso : null,
    accepted_at: p.status === "accepted" ? nowIso : null,
    rejected_at: p.status === "rejected" ? nowIso : null,
    ...snapshots,
  };

  const { data: q, error: qErr } = await supabase.from("quotes").insert(insertRow).select("id").single();

  if (qErr || !q) {
    return NextResponse.json({ ok: false, error: qErr?.message ?? "Offerte aanmaken mislukt." }, { status: 500 });
  }

  const quoteId = q.id as string;
  const itemInserts = lineRows.map((r) => ({
    quote_id: quoteId,
    description: r.description,
    quantity: r.quantity,
    unit_price: r.unit_price,
    line_total: r.line_total,
    position: r.position,
  }));

  const { error: itemsErr } = await supabase.from("quote_items").insert(itemInserts);
  if (itemsErr) {
    await supabase.from("quotes").delete().eq("id", quoteId);
    return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });
  }

  revalidatePath("/admin/quotes");
  revalidatePath("/admin/ops");
  revalidatePath(`/admin/quotes/${quoteId}`);

  const { data: full } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  return NextResponse.json({ ok: true, data: full });
}

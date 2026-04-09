import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { actorDisplayLabel } from "@/lib/auth/actor-display-label";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { createDealBodySchema } from "@/lib/sales-os/api-schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET() {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("sales_deals").select("*").order("updated_at", { ascending: false });
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
  const parsed = createDealBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const p = parsed.data;
  const supabase = createServiceRoleClient();
  const row = {
    company_name: p.company_name,
    title: p.title ?? "",
    stage: p.stage,
    value_cents: p.value_cents,
    currency: p.currency,
    owner_label: actorDisplayLabel(auth.userId, auth.email),
    probability: p.probability ?? null,
    next_step: p.next_step ?? null,
    next_step_due_at: p.next_step_due_at || null,
    lead_id: p.lead_id ?? null,
    client_id: p.client_id ?? null,
    at_risk: false,
  };
  const { data, error } = await supabase.from("sales_deals").insert(row).select("*").single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  revalidatePath("/admin/ops", "layout");
  return NextResponse.json({ ok: true, data });
}

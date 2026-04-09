import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorDisplayLabel } from "@/lib/auth/actor-display-label";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const bodySchema = z.object({
  title: z.string().max(500).optional().default(""),
  value_cents: z.number().int().min(0).optional().default(0),
  stage: z.enum(["new_lead", "qualified", "proposal_sent"]).optional().default("qualified"),
});

type Ctx = { params: Promise<{ id: string }> };

/** Maakt een deal aan en zet lead op converted + converted_deal_id. */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const { id: leadId } = await context.params;
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: lead, error: le } = await supabase.from("sales_leads").select("*").eq("id", leadId).maybeSingle();
  if (le || !lead) {
    return NextResponse.json({ ok: false, error: "Lead niet gevonden." }, { status: 404 });
  }
  if (lead.status === "converted") {
    return NextResponse.json({ ok: false, error: "Lead is al geconverteerd." }, { status: 400 });
  }

  const { data: deal, error: de } = await supabase
    .from("sales_deals")
    .insert({
      lead_id: leadId,
      company_name: lead.company_name,
      title: parsed.data.title || `Deal — ${lead.company_name}`,
      stage: parsed.data.stage,
      value_cents: parsed.data.value_cents,
      currency: "EUR",
      next_step: "Eerste sales-gesprek plannen",
      owner_label: actorDisplayLabel(auth.userId, auth.email),
    })
    .select("*")
    .single();
  if (de || !deal) {
    return NextResponse.json({ ok: false, error: de?.message ?? "Deal aanmaken mislukt." }, { status: 500 });
  }

  const { error: ue } = await supabase
    .from("sales_leads")
    .update({
      status: "converted",
      converted_deal_id: deal.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (ue) {
    return NextResponse.json({ ok: false, error: ue.message }, { status: 500 });
  }

  revalidatePath("/admin/ops", "layout");
  return NextResponse.json({ ok: true, data: { deal } });
}

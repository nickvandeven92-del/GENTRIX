import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { actorDisplayLabel } from "@/lib/auth/actor-display-label";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { createLeadBodySchema } from "@/lib/sales-os/api-schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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
  const parsed = createLeadBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const p = parsed.data;
  const supabase = createServiceRoleClient();
  const nextFollow = p.next_follow_up_at || null;
  const { data, error } = await supabase
    .from("sales_leads")
    .insert({
      company_name: p.company_name,
      contact_name: p.contact_name ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      source: p.source,
      status: "new",
      budget_estimate: p.budget_estimate ?? null,
      notes: p.notes ?? null,
      owner_label: actorDisplayLabel(auth.userId, auth.email),
      next_follow_up_at: nextFollow,
      follow_up_reminder_state: nextFollow ? { at: nextFollow, fired: [] } : {},
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  revalidatePath("/admin/ops", "layout");
  return NextResponse.json({ ok: true, data });
}

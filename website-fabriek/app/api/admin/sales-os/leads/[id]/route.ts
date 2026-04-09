import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { actorDisplayLabel } from "@/lib/auth/actor-display-label";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { patchLeadBodySchema } from "@/lib/sales-os/api-schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const parsed = patchLeadBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ ok: false, error: "Geen velden." }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  const row: Record<string, unknown> = {
    ...parsed.data,
    owner_label: actorDisplayLabel(auth.userId, auth.email),
  };
  if (Object.prototype.hasOwnProperty.call(parsed.data, "next_follow_up_at")) {
    const v = parsed.data.next_follow_up_at;
    if (v == null) {
      row.follow_up_reminder_state = {};
    } else {
      row.follow_up_reminder_state = { at: v, fired: [] };
    }
  }
  const { data, error } = await supabase.from("sales_leads").update(row).eq("id", id).select("*").single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Lead niet gevonden." }, { status: 404 });
  }
  revalidatePath("/admin/ops", "layout");
  return NextResponse.json({ ok: true, data });
}

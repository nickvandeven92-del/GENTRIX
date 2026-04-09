import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { actorDisplayLabel } from "@/lib/auth/actor-display-label";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { patchDealBodySchema } from "@/lib/sales-os/api-schemas";
import { isClosedDealStage } from "@/lib/sales-os/deal-stages";
import type { SalesDealStage } from "@/lib/sales-os/deal-stages";
import type { SalesDealRow } from "@/lib/data/sales-deals";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseDealStepLog } from "@/lib/sales-os/deal-step-log";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Ontbrekend id." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const parsed = patchDealBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("sales_deals")
    .select("id, stage, next_step_log")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !existing) {
    return NextResponse.json({ ok: false, error: "Deal niet gevonden." }, { status: 404 });
  }

  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k === "planning_commit" || v === undefined) continue;
    row[k] = v;
  }

  if (parsed.data.planning_commit) {
    const { message, due_at } = parsed.data.planning_commit;
    const prev = parseDealStepLog(existing.next_step_log as SalesDealRow["next_step_log"]);
    const logged_at = new Date().toISOString();
    const dueIso = new Date(due_at);
    if (Number.isNaN(dueIso.getTime())) {
      return NextResponse.json({ ok: false, error: "Ongeldige opvolgdatum." }, { status: 400 });
    }
    row.next_step_log = [
      ...prev,
      {
        message: message.trim(),
        due_at: dueIso.toISOString(),
        logged_at,
        logged_by_label: actorDisplayLabel(auth.userId, auth.email),
      },
    ];
    row.next_step = null;
    row.next_step_due_at = null;
  }

  const newStage = parsed.data.stage as SalesDealStage | undefined;

  if (newStage === "won") {
    row.won_at = new Date().toISOString();
    row.lost_at = null;
    row.lost_reason = null;
    row.at_risk = false;
  } else if (newStage === "lost") {
    row.lost_at = new Date().toISOString();
    row.won_at = null;
    row.at_risk = false;
  } else if (newStage && !isClosedDealStage(newStage)) {
    row.won_at = null;
    row.lost_at = null;
  }

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ ok: false, error: "Geen velden om bij te werken." }, { status: 400 });
  }

  row.owner_label = actorDisplayLabel(auth.userId, auth.email);

  const { data, error } = await supabase.from("sales_deals").update(row).eq("id", id).select("*").single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/admin/ops", "layout");
  revalidatePath(`/admin/ops/deals/${id}`);
  return NextResponse.json({ ok: true, data });
}

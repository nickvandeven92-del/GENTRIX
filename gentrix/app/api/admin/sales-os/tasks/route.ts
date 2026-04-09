import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { actorDisplayLabel } from "@/lib/auth/actor-display-label";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { createTaskBodySchema } from "@/lib/sales-os/api-schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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
  const parsed = createTaskBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const p = parsed.data;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("sales_tasks")
    .insert({
      title: p.title,
      description: p.description ?? null,
      status: "open",
      priority: p.priority,
      due_at: p.due_at || null,
      owner_label: actorDisplayLabel(auth.userId, auth.email),
      linked_entity_type: p.linked_entity_type,
      linked_entity_id: p.linked_entity_id,
      source_type: p.source_type,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  revalidatePath("/admin/ops", "layout");
  return NextResponse.json({ ok: true, data });
}

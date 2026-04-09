import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { patchWebsiteOpsBodySchema } from "@/lib/sales-os/api-schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type Ctx = { params: Promise<{ clientId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const { clientId } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const parsed = patchWebsiteOpsBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ ok: false, error: "Geen velden." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("website_ops_state")
    .update(parsed.data)
    .eq("client_id", clientId)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "website_ops_state niet gevonden voor client." }, { status: 404 });
  }
  revalidatePath("/admin/ops", "layout");
  revalidatePath("/admin/ops/websites");
  return NextResponse.json({ ok: true, data });
}

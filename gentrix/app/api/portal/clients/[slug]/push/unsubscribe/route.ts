import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { requirePortalOwnerForClient } from "@/lib/auth/require-portal-owner-for-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const bodySchema = z.object({
  endpoint: z.string().url(),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  const owner = await requirePortalOwnerForClient(access.clientId, access.userId);
  if (!owner.ok) {
    return NextResponse.json({ ok: false, error: owner.message }, { status: owner.status });
  }

  if (!checkPortalRateLimit(access.userId, `portal:push:unsub:${slug}`, 40)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken. Probeer zo opnieuw." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("portal_push_subscriptions")
      .delete()
      .eq("endpoint", parsed.data.endpoint)
      .eq("user_id", access.userId)
      .eq("client_id", access.clientId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.union([z.string().max(2000), z.literal(""), z.null()]).optional(),
  duration_minutes: z.number().int().min(10).max(480).optional(),
  price_cents: z.union([z.number().int().min(0), z.null()]).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

const SELECT =
  "id, name, description, duration_minutes, price_cents, is_active, sort_order, created_at, updated_at";

type RouteContext = { params: Promise<{ slug: string; id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { slug: raw, id: serviceId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:book-svc:patch:${slug}`, 80)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken. Probeer over een minuut opnieuw." }, { status: 429 });
  }
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Niet beschikbaar voor deze klant." }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) {
    updates.description =
      parsed.data.description === "" || parsed.data.description === null ? null : parsed.data.description.trim();
  }
  if (parsed.data.duration_minutes !== undefined) updates.duration_minutes = parsed.data.duration_minutes;
  if (parsed.data.price_cents !== undefined) updates.price_cents = parsed.data.price_cents;
  if (parsed.data.sort_order !== undefined) updates.sort_order = parsed.data.sort_order;
  if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "Geen velden om bij te werken." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("client_booking_services")
      .update(updates)
      .eq("id", serviceId)
      .eq("client_id", resolved.clientId)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "Behandeling niet gevonden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, service: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug: raw, id: serviceId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:book-svc:del:${slug}`, 40)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken. Probeer over een minuut opnieuw." }, { status: 429 });
  }
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Niet beschikbaar voor deze klant." }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { error, count } = await supabase
      .from("client_booking_services")
      .delete({ count: "exact" })
      .eq("id", serviceId)
      .eq("client_id", resolved.clientId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json({ ok: false, error: "Behandeling niet gevonden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

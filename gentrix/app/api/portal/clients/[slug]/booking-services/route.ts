import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const postSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  duration_minutes: z.number().int().min(10).max(480),
  price_cents: z.number().int().min(0).optional().nullable(),
  sort_order: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ slug: string }> };

const SELECT =
  "id, name, description, duration_minutes, price_cents, is_active, sort_order, created_at, updated_at";

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:book-svc:get:${slug}`, 120)) {
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
    const { data, error } = await supabase
      .from("client_booking_services")
      .select(SELECT)
      .eq("client_id", resolved.clientId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      if (error.message.includes("client_booking_services") || error.code === "42P01") {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260408150000_client_booking_services.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, services: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:book-svc:post:${slug}`, 60)) {
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
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const desc = parsed.data.description?.trim() || null;
  const price =
    parsed.data.price_cents === undefined || parsed.data.price_cents === null ? null : parsed.data.price_cents;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("client_booking_services")
      .insert({
        client_id: resolved.clientId,
        name: parsed.data.name.trim(),
        description: desc,
        duration_minutes: parsed.data.duration_minutes,
        price_cents: price,
        sort_order: parsed.data.sort_order ?? 0,
      })
      .select(SELECT)
      .single();

    if (error) {
      if (error.message.includes("client_booking_services") || error.code === "42P01") {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260408150000_client_booking_services.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, service: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

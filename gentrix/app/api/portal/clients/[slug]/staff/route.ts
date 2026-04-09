import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const postSchema = z.object({
  name: z.string().min(1).max(120),
  sort_order: z.number().int().optional(),
  color_hex: z
    .union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal(""), z.null()])
    .optional(),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:staff:get:${slug}`, 120)) {
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
      .from("client_staff")
      .select("id, name, sort_order, color_hex, is_active, created_at")
      .eq("client_id", resolved.clientId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      if (error.message.includes("client_staff") || error.code === "42P01") {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260407140000_client_staff_and_shifts.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, staff: data ?? [] });
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
  if (!checkPortalRateLimit(access.userId, `portal:staff:post:${slug}`, 60)) {
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

  const color =
    parsed.data.color_hex === "" || parsed.data.color_hex === null || parsed.data.color_hex === undefined
      ? null
      : parsed.data.color_hex;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("client_staff")
      .insert({
        client_id: resolved.clientId,
        name: parsed.data.name.trim(),
        sort_order: parsed.data.sort_order ?? 0,
        color_hex: color,
      })
      .select("id, name, sort_order, color_hex, is_active, created_at")
      .single();

    if (error) {
      if (error.message.includes("client_staff") || error.code === "42P01") {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260407140000_client_staff_and_shifts.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, member: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

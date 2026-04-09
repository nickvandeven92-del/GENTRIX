import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  staffShiftWindowErrorMessage,
  validateStaffShiftWindow,
} from "@/lib/staff/staff-shift-validation";

const MS_DAY = 86_400_000;
/** Max query range per GET (voorkomt enorme payloads). */
const MAX_RANGE_DAYS = 98;

const postSchema = z.object({
  staff_id: z.string().uuid(),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:staff-shifts:get:${slug}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken. Probeer over een minuut opnieuw." }, { status: 429 });
  }
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Niet beschikbaar voor deze klant." }, { status: 403 });
  }

  const url = new URL(request.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  if (!fromStr || !toStr) {
    return NextResponse.json({ ok: false, error: "Parameters from en to (ISO) zijn verplicht." }, { status: 400 });
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ ok: false, error: "Ongeldige from/to." }, { status: 400 });
  }
  if (to <= from) {
    return NextResponse.json({ ok: false, error: "to moet na from liggen." }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * MS_DAY) {
    return NextResponse.json(
      { ok: false, error: `Maximaal ${MAX_RANGE_DAYS} dagen per verzoek.` },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("client_staff_shifts")
      .select("id, staff_id, starts_at, ends_at, notes, created_at, updated_at")
      .eq("client_id", resolved.clientId)
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString())
      .order("starts_at", { ascending: true });

    if (error) {
      if (error.message.includes("client_staff_shifts") || error.code === "42P01") {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260407140000_client_staff_and_shifts.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, shifts: data ?? [] });
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
  if (!checkPortalRateLimit(access.userId, `portal:staff-shifts:post:${slug}`, 80)) {
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

  const starts = new Date(parsed.data.starts_at);
  const ends = new Date(parsed.data.ends_at);
  const win = validateStaffShiftWindow(starts, ends);
  if (win) {
    return NextResponse.json({ ok: false, error: staffShiftWindowErrorMessage(win) }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const staffCheck = await supabase
      .from("client_staff")
      .select("id")
      .eq("id", parsed.data.staff_id)
      .eq("client_id", resolved.clientId)
      .maybeSingle();
    if (staffCheck.error || !staffCheck.data) {
      return NextResponse.json({ ok: false, error: "Medewerker niet gevonden." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("client_staff_shifts")
      .insert({
        client_id: resolved.clientId,
        staff_id: parsed.data.staff_id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        notes: parsed.data.notes?.trim() || null,
      })
      .select("id, staff_id, starts_at, ends_at, notes, created_at, updated_at")
      .single();

    if (error) {
      if (error.message.includes("client_staff_shifts") || error.code === "42P01") {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260407140000_client_staff_and_shifts.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, shift: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

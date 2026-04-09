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

const patchSchema = z.object({
  starts_at: z.string().min(1).optional(),
  ends_at: z.string().min(1).optional(),
  notes: z.string().max(500).optional().nullable(),
});

type RouteContext = { params: Promise<{ slug: string; id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { slug: raw, id: shiftId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:staff-shifts:patch:${slug}`, 80)) {
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

  try {
    const supabase = createServiceRoleClient();
    const existing = await supabase
      .from("client_staff_shifts")
      .select("starts_at, ends_at, notes")
      .eq("id", shiftId)
      .eq("client_id", resolved.clientId)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return NextResponse.json({ ok: false, error: "Dienst niet gevonden." }, { status: 404 });
    }

    const starts =
      parsed.data.starts_at !== undefined
        ? new Date(parsed.data.starts_at)
        : new Date(existing.data.starts_at);
    const ends =
      parsed.data.ends_at !== undefined ? new Date(parsed.data.ends_at) : new Date(existing.data.ends_at);

    const win = validateStaffShiftWindow(starts, ends);
    if (win) {
      return NextResponse.json({ ok: false, error: staffShiftWindowErrorMessage(win) }, { status: 400 });
    }

    const finalPatch: Record<string, unknown> = {};
    if (parsed.data.starts_at !== undefined) finalPatch.starts_at = starts.toISOString();
    if (parsed.data.ends_at !== undefined) finalPatch.ends_at = ends.toISOString();
    if (parsed.data.notes !== undefined) finalPatch.notes = parsed.data.notes?.trim() || null;

    if (Object.keys(finalPatch).length === 0) {
      return NextResponse.json({ ok: false, error: "Geen velden om bij te werken." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("client_staff_shifts")
      .update(finalPatch)
      .eq("id", shiftId)
      .eq("client_id", resolved.clientId)
      .select("id, staff_id, starts_at, ends_at, notes, created_at, updated_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "Dienst niet gevonden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, shift: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug: raw, id: shiftId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:staff-shifts:del:${slug}`, 60)) {
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
      .from("client_staff_shifts")
      .delete({ count: "exact" })
      .eq("id", shiftId)
      .eq("client_id", resolved.clientId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json({ ok: false, error: "Dienst niet gevonden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

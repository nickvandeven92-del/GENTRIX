import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  sort_order: z.number().int().optional(),
  color_hex: z
    .union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal(""), z.null()])
    .optional(),
  is_active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ slug: string; id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { slug: raw, id: staffId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:staff:patch:${slug}`, 80)) {
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
  if (parsed.data.sort_order !== undefined) updates.sort_order = parsed.data.sort_order;
  if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;
  if (parsed.data.color_hex !== undefined) {
    updates.color_hex =
      parsed.data.color_hex === "" || parsed.data.color_hex === null ? null : parsed.data.color_hex;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "Geen velden om bij te werken." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("client_staff")
      .update(updates)
      .eq("id", staffId)
      .eq("client_id", resolved.clientId)
      .select("id, name, sort_order, color_hex, is_active, created_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "Medewerker niet gevonden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, member: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug: raw, id: staffId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:staff:del:${slug}`, 40)) {
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
      .from("client_staff")
      .delete({ count: "exact" })
      .eq("id", staffId)
      .eq("client_id", resolved.clientId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json({ ok: false, error: "Medewerker niet gevonden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

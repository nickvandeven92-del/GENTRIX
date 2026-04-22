import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import { slugify, isValidSubfolderSlug } from "@/lib/slug";
import { generateClientNumber } from "@/lib/commercial/document-numbering";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/types/database";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Maakt een klantrecord op basis van leadgegevens (voor offerte/factuur).
 * Genereert een unieke subfolder_slug; site_data_json minimaal.
 */
export async function POST(_request: Request, context: Ctx) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { id: leadId } = await context.params;
  const supabase = createServiceRoleClient();
  const { data: lead, error: le } = await supabase.from("sales_leads").select("*").eq("id", leadId).maybeSingle();
  if (le || !lead) {
    return NextResponse.json({ ok: false, error: "Lead niet gevonden." }, { status: 404 });
  }

  const base = slugify(lead.company_name || "klant");
  let candidate = (base.length >= 2 ? base : `klant-${leadId.slice(0, 8)}`).slice(0, 64);
  if (!isValidSubfolderSlug(candidate)) {
    candidate = `klant-${leadId.slice(0, 8)}`;
  }

  for (let i = 0; i < 40; i++) {
    const slugTry = i === 0 ? candidate : `${candidate}-${i + 1}`.slice(0, 64);
    if (!isValidSubfolderSlug(slugTry)) continue;

    let clientNumber: string;
    try {
      clientNumber = await generateClientNumber(supabase);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Klantnummer genereren mislukt." },
        { status: 500 },
      );
    }

    const row = {
      name: lead.company_name.trim() || "Klant",
      subfolder_slug: slugTry,
      site_data_json: {} as Json,
      status: "draft" as const,
      generation_package: STUDIO_GENERATION_PACKAGE,
      company_legal_name: lead.company_name.trim() || null,
      contact_name: lead.contact_name?.trim() || null,
      billing_email: lead.email?.trim() || null,
      phone: lead.phone?.trim() || null,
      pipeline_stage: "lead",
      client_number: clientNumber,
    };

    const { data: inserted, error: insErr } = await supabase.from("clients").insert(row).select("id, subfolder_slug").single();

    if (!insErr && inserted) {
      revalidatePath("/admin/clients");
      revalidatePath("/admin/ops");
      return NextResponse.json({ ok: true, data: inserted });
    }

    const msg = (insErr?.message ?? "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      continue;
    }
    return NextResponse.json({ ok: false, error: insErr?.message ?? "Klant aanmaken mislukt." }, { status: 500 });
  }

  return NextResponse.json({ ok: false, error: "Kon geen vrije site-slug vinden." }, { status: 500 });
}

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { EnrichedLeadPayload } from "@/lib/leads/kvk-enrichment-types";

export type KvkEnrichedLeadRow = {
  id: string;
  company_name: string;
  kvk_number: string;
  city: string | null;
  website_url: string | null;
  website_status: string;
  website_detection_source: string | null;
  website_quality_score: number | null;
  opportunity_score: number;
  call_angle: string;
  reason_codes: string[];
  enrichment_raw_json: unknown;
  created_at: string;
  updated_at: string;
  last_checked_at: string;
};

export async function upsertKvkEnrichedLead(payload: EnrichedLeadPayload): Promise<KvkEnrichedLeadRow> {
  const supabase = createServiceRoleClient();
  const p = payload.profile;
  const d = payload.detection;
  const q = payload.quality;
  const o = payload.opportunity;

  const companyName = p.naam?.trim() || p.statutaireNaam?.trim() || "Onbekend";
  const city = p.plaats ?? null;
  const websiteUrl = d.finalUrl ?? d.detectedUrl ?? null;

  const row = {
    company_name: companyName,
    kvk_number: p.kvkNummer,
    city,
    website_url: websiteUrl,
    website_status: o.websiteStatus,
    website_detection_source: d.detectionSource,
    website_quality_score: q?.score ?? null,
    opportunity_score: o.opportunityScore,
    call_angle: o.callAngle,
    reason_codes: o.reasonCodes,
    enrichment_raw_json: payload as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("kvk_enriched_leads")
    .upsert(row, { onConflict: "kvk_number" })
    .select("*")
    .single();

  if (error) {
    console.error("[kvk_enriched_leads] upsert error", error.message);
    throw new Error(error.message);
  }

  return data as KvkEnrichedLeadRow;
}

export async function listKvkEnrichedLeads(limit = 50): Promise<KvkEnrichedLeadRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("kvk_enriched_leads")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[kvk_enriched_leads] list error", error.message);
    return [];
  }
  return (data ?? []) as KvkEnrichedLeadRow[];
}

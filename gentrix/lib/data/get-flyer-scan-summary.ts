import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export type FlyerScanSummary = {
  total: number;
  lastScannedAt: string | null;
  /** Hits in de laatste 7 dagen (kalender). */
  last7Days: number;
};

/**
 * Samenvatting voor klantdossier / studio (service role).
 */
export async function getFlyerScanSummary(clientId: string): Promise<FlyerScanSummary | null> {
  try {
    const supabase = createServiceRoleClient();
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceIso = since.toISOString();

    const { count: total, error: cErr } = await supabase
      .from("flyer_scans")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);

    if (cErr) {
      if (isPostgrestUnknownColumnError(cErr, "flyer_scans")) return null;
      return null;
    }

    const { data: lastRow, error: lErr } = await supabase
      .from("flyer_scans")
      .select("scanned_at")
      .eq("client_id", clientId)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lErr && !isPostgrestUnknownColumnError(lErr, "flyer_scans")) {
      return null;
    }

    const { count: last7, error: wErr } = await supabase
      .from("flyer_scans")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("scanned_at", sinceIso);

    if (wErr) {
      return {
        total: total ?? 0,
        lastScannedAt: (lastRow as { scanned_at?: string } | null)?.scanned_at ?? null,
        last7Days: 0,
      };
    }

    return {
      total: total ?? 0,
      lastScannedAt: (lastRow as { scanned_at?: string } | null)?.scanned_at ?? null,
      last7Days: last7 ?? 0,
    };
  } catch {
    return null;
  }
}

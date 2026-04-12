import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

function truncate(s: string | null | undefined, max: number): string | null {
  const t = s?.trim();
  if (!t) return null;
  return t.length <= max ? t : t.slice(0, max);
}

/**
 * Logt een flyer/QR-hit (niet-blokkerend voor de redirect).
 */
export async function recordFlyerScanByToken(input: {
  flyerPublicToken: string;
  userAgent?: string | null;
  referer?: string | null;
}): Promise<void> {
  const token = input.flyerPublicToken.trim();
  if (!token) return;

  try {
    const supabase = createServiceRoleClient();
    const { data: row, error: qErr } = await supabase
      .from("clients")
      .select("id")
      .eq("flyer_public_token", token)
      .maybeSingle();

    if (qErr && isPostgrestUnknownColumnError(qErr, "flyer_public_token")) {
      return;
    }
    if (qErr || !row?.id) return;

    const { error: insErr } = await supabase.from("flyer_scans").insert({
      client_id: row.id,
      user_agent: truncate(input.userAgent, 600),
      referer: truncate(input.referer, 600),
    });

    if (insErr) return;
  } catch {
    /* no-op: tracking mag redirect nooit breken */
  }
}

import { createServiceRoleClient } from "@/lib/supabase/service-role";

type UnreadRpcRow = { thread_id: string; unread_count: number | string };

/**
 * Per-thread aantal studio-berichten na `customer_last_read_at`.
 * Lege map bij ontbrekende RPC/tabel of service key.
 */
export async function fetchPortalSupportUnreadCountsByThread(clientId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("portal_support_unread_staff_by_thread", {
      p_client_id: clientId,
    });
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[portal_support_unread]", error.message);
      }
      return out;
    }
    const rows = (data ?? []) as UnreadRpcRow[];
    for (const r of rows) {
      const n = typeof r.unread_count === "string" ? parseInt(r.unread_count, 10) : r.unread_count;
      if (r.thread_id && Number.isFinite(n) && n > 0) out.set(r.thread_id, n);
    }
  } catch {
    /* geen service role */
  }
  return out;
}

export type PortalSupportUnreadSummary = {
  /** Som van ongelezen studio-berichten in open threads */
  totalUnreadStaffMessages: number;
  /** Open threads met ≥1 ongelezen studio-bericht */
  openThreadsWithUnread: number;
};

export async function getPortalSupportUnreadSummary(clientId: string): Promise<PortalSupportUnreadSummary> {
  try {
    const supabase = createServiceRoleClient();
    const [unreadMap, openRes] = await Promise.all([
      fetchPortalSupportUnreadCountsByThread(clientId),
      supabase.from("client_support_threads").select("id").eq("client_id", clientId).eq("status", "open"),
    ]);
    if (openRes.error) {
      return { totalUnreadStaffMessages: 0, openThreadsWithUnread: 0 };
    }
    const openIds = new Set((openRes.data ?? []).map((r) => (r as { id: string }).id));
    let totalUnreadStaffMessages = 0;
    let openThreadsWithUnread = 0;
    for (const [tid, c] of unreadMap) {
      if (!openIds.has(tid)) continue;
      totalUnreadStaffMessages += c;
      if (c > 0) openThreadsWithUnread += 1;
    }
    return { totalUnreadStaffMessages, openThreadsWithUnread };
  } catch {
    return { totalUnreadStaffMessages: 0, openThreadsWithUnread: 0 };
  }
}

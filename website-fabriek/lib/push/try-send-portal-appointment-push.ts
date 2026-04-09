import webpush from "web-push";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function formatWhenNl(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return startsAt;
  const d = new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(s);
  const t = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(e);
  return `${d} – ${t}`;
}

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Stuurt Web Push naar alle inschrijvingen voor deze klant (portaal).
 * Geen-op als VAPID ontbreekt, geen subscriptions, of tabel nog niet gemigreerd.
 */
export async function trySendPortalAppointmentPushNotifications(params: {
  clientId: string;
  appointmentTitle: string;
  startsAt: string;
  endsAt: string;
  bookerName: string | null;
}): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return;

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return;
  }

  const { data: subs, error } = await supabase
    .from("portal_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("client_id", params.clientId);

  if (error) {
    const m = error.message.toLowerCase();
    if (
      m.includes("portal_push_subscriptions") &&
      (m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find"))
    ) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[push] portal_push_subscriptions ontbreekt — migratie uitvoeren?");
      }
      return;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[push] subscriptions laden:", error.message);
    }
    return;
  }

  const rows = (subs ?? []) as SubRow[];
  if (rows.length === 0) return;

  const { data: clientRow } = await supabase
    .from("clients")
    .select("subfolder_slug")
    .eq("id", params.clientId)
    .maybeSingle();

  const slug = (clientRow as { subfolder_slug?: string } | null)?.subfolder_slug?.trim();
  const base = getPublicAppUrl().replace(/\/$/, "");
  const openUrl = slug ? `${base}/portal/${encodeURIComponent(slug)}/afspraken` : `${base}/home`;

  const when = formatWhenNl(params.startsAt, params.endsAt);
  const booker = params.bookerName?.trim();
  const body = booker
    ? `${params.appointmentTitle} · ${when} · ${booker}`
    : `${params.appointmentTitle} · ${when}`;

  const payload = JSON.stringify({
    title: "Nieuwe afspraak",
    body,
    url: openUrl,
  });

  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:noreply@localhost";
  webpush.setVapidDetails(subject, publicKey, privateKey);

  for (const row of rows) {
    const pushSub = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(pushSub, payload, { TTL: 86_400 });
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("portal_push_subscriptions").delete().eq("id", row.id);
      } else if (process.env.NODE_ENV === "development") {
        console.warn("[push] send:", e);
      }
    }
  }
}

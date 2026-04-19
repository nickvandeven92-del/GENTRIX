import Link from "next/link";
import { parseBookingSettings } from "@/lib/booking/booking-settings";
import { formatBookingSettingsSummaryNl } from "@/lib/booking/format-booking-settings-summary-nl";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

type Props = {
  clientId: string;
  subfolderSlug: string;
  bookingAbsoluteUrl: string;
};

/**
 * Read-only samenvatting voor studio: zelfde `booking_settings` als portaal + /boek.
 */
export async function AdminBookingAgendaSummary({ clientId, subfolderSlug, bookingAbsoluteUrl }: Props) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("clients").select("booking_settings").eq("id", clientId).maybeSingle();

  if (error && isPostgrestUnknownColumnError(error, "booking_settings")) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/25">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
          Boekagenda
        </h2>
        <p className="mt-2 text-sm text-amber-950/90 dark:text-amber-100/90">
          Migratie <code className="rounded bg-white/70 px-1 text-xs dark:bg-amber-950/50">20260407120000_clients_booking_settings.sql</code>{" "}
          nog niet uitgevoerd — kolom <code className="text-xs">booking_settings</code> ontbreekt.
        </p>
      </section>
    );
  }

  if (error) return null;

  const raw = (data as { booking_settings?: unknown } | null)?.booking_settings;
  const settings = parseBookingSettings(raw ?? null);
  const summary = formatBookingSettingsSummaryNl(settings);
  const enc = encodeURIComponent(subfolderSlug);

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-900/45 dark:bg-violet-950/20">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
        Boekagenda (één bron met site)
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        De klant zet <strong className="text-zinc-900 dark:text-zinc-100">werkdagen en tijden</strong> in het portaal; dat
        is exact dezelfde data als op de{" "}
        <a
          href={bookingAbsoluteUrl}
          className="font-medium text-violet-800 underline underline-offset-2 dark:text-violet-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          publieke boekpagina
        </a>
        . De weekplanning op Afspraken toont die combinatie.
      </p>
      <p className="mt-2 rounded-lg border border-violet-200/80 bg-white/80 px-3 py-2 font-mono text-[11px] leading-snug text-zinc-700 dark:border-violet-900/40 dark:bg-zinc-900/50 dark:text-zinc-300">
        {summary}
      </p>
      <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
        Portaal (klant):{" "}
        <Link
          href={`/portal/${enc}/boekingen?tab=afspraken#online-boekagenda`}
          className="font-medium text-violet-800 underline underline-offset-2 dark:text-violet-300"
        >
          Afspraken → Online boekagenda
        </Link>
      </p>
    </section>
  );
}

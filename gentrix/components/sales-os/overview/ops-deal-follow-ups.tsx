import Link from "next/link";
import type { DealFollowUpDashboardRow } from "@/lib/sales-os/deal-step-log";
import { formatEURFromCents } from "@/lib/sales-os/format-money";
import { DEAL_STAGE_LABELS } from "@/lib/sales-os/deal-stages";
import { cn } from "@/lib/utils";

function formatDueNl(iso: string | null): string {
  if (!iso) return "Geen datum";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OpsDealFollowUps({
  rows,
  totalCount,
  variant = "cockpit",
}: {
  rows: DealFollowUpDashboardRow[];
  /** Totaal (vóór slice); toont “nog N …” als groter dan rows.length. */
  totalCount?: number;
  variant?: "default" | "cockpit";
}) {
  const cockpit = variant === "cockpit";
  const fullTotal = totalCount ?? rows.length;
  const extra = fullTotal - rows.length;
  const shell = cockpit
    ? "rounded-xl bg-neutral-50/30 py-5 ring-1 ring-neutral-950/[0.04]"
    : "overflow-hidden rounded-lg border border-neutral-200/70 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]";
  const headPad = cockpit ? "px-5 pb-4" : "border-b border-neutral-200 px-4 py-3";
  const listPad = cockpit ? "px-5" : "px-4";

  if (rows.length === 0) {
    return (
      <section id="deal-opvolging" className={shell}>
        <div className={headPad}>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Deal-opvolging</h2>
          <p className="mt-2 text-[15px] font-medium text-neutral-900">Geen geplande opvolging</p>
          <p className="mt-1 text-[12px] text-neutral-500">
            Vastgelegde stappen op een deal verschijnen hier (niet onder Openstaande taken — dat zijn aparte taken).
          </p>
          <Link
            href="/admin/ops/deals"
            className="mt-3 inline-block text-[12px] font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
          >
            Naar deals
          </Link>
        </div>
      </section>
    );
  }

  const now = Date.now();

  return (
    <section id="deal-opvolging" className={shell}>
      <div className={headPad}>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Deal-opvolging</h2>
        <p className="mt-1 text-[12px] text-neutral-500">
          Volgende stap en opvolgdatum per open deal (ook na &apos;vastleggen&apos; op de dealpagina).
        </p>
      </div>
      <ul className={cn("divide-y divide-neutral-100/90", listPad)}>
        {rows.map(({ deal, dueAt, message }) => {
          const dueMs = dueAt ? new Date(dueAt).getTime() : NaN;
          const overdue = !Number.isNaN(dueMs) && dueMs < now;
          return (
            <li key={deal.id} className="py-3.5 first:pt-0">
              <Link
                href={`/admin/ops/deals/${deal.id}`}
                className="group block rounded-lg outline-none ring-neutral-950/10 transition-colors hover:bg-white/60 focus-visible:ring-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-neutral-950 group-hover:underline">{deal.company_name}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {DEAL_STAGE_LABELS[deal.stage]} · {formatEURFromCents(deal.value_cents)}
                    </p>
                    <p className="mt-2 text-[13px] font-medium leading-snug text-neutral-900">{message ?? "—"}</p>
                    <p
                      className={cn(
                        "mt-1 text-[11px] tabular-nums",
                        overdue ? "font-medium text-rose-600" : "text-neutral-500",
                      )}
                    >
                      {overdue ? "Te laat · " : null}
                      Opvolg: {formatDueNl(dueAt)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className={cn("border-t border-neutral-100/80 py-3", cockpit ? "px-5" : "px-4")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          <Link
            href="/admin/ops/pipeline"
            className="text-[12px] font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
          >
            Pijplijn bekijken
          </Link>
          {extra > 0 ? (
            <p className="text-[11px] text-neutral-500">
              Nog {extra} deal(s) met opvolging —{" "}
              <Link href="/admin/ops/deals" className="font-medium text-neutral-800 underline">
                alle deals
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

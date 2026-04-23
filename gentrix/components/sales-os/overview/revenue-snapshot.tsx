import type { RevenueSnapshotMetrics } from "@/lib/sales-os/signals";
import { formatEURFromCents } from "@/lib/sales-os/format-money";

type RevenueSnapshotProps = {
  metrics: RevenueSnapshotMetrics;
  variant?: "default" | "cockpit";
};

export function RevenueSnapshot({ metrics, variant = "default" }: RevenueSnapshotProps) {
  const rows: { label: string; value: string; sub: string }[] = [
    {
      label: "Open dealwaarde",
      value: formatEURFromCents(metrics.openPipelineCents),
      sub: "Som open deals (excl. gewonnen/verloren)",
    },
    {
      label: "Gewogen pijplijn",
      value: formatEURFromCents(metrics.weightedPipelineCents),
      sub: "Waarde × kans (35% standaard indien leeg)",
    },
    {
      label: "Gewonnen (30 dagen)",
      value: `${metrics.won30dCount} · ${formatEURFromCents(metrics.won30dCents)}`,
      sub: "Deals met won_at in venster",
    },
    {
      label: "Verlengingen (30 dagen)",
      value: String(metrics.renewals30dCount),
      sub: "Klanten met subscription_renews_at in venster",
    },
  ];

  if (variant === "cockpit") {
    return (
      <section className="rounded-lg bg-neutral-50/30 py-3 ring-1 ring-neutral-950/[0.04]">
        <div className="px-4 pb-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Omzet</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">Open deals en recente gewonnen.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4">
          {rows.map((m) => (
            <div key={m.label}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{m.label}</p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-neutral-950 md:text-2xl">
                {m.value}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">{m.sub}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200/70 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <div className="border-b border-neutral-200/80 px-4 py-3.5">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">Omzetoverzicht</h2>
        <p className="mt-0.5 text-[11px] text-neutral-500">Alleen wat uit de database volgt — geen schijn-MRR.</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-neutral-100 border-t border-neutral-100">
        {rows.map((m) => (
          <div key={m.label} className="bg-white px-4 py-3.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{m.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-neutral-900">{m.value}</p>
            <p className="mt-1 text-[10px] text-neutral-500">{m.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import type { OpsPrioritySignal } from "@/lib/sales-os/signals";
import { cn } from "@/lib/utils";

function severityStyles(s: OpsPrioritySignal["severity"]) {
  switch (s) {
    case "critical":
      return { bar: "bg-rose-500", label: "text-rose-700" };
    case "attention":
      return { bar: "bg-amber-500", label: "text-amber-800" };
    default:
      return { bar: "bg-neutral-300", label: "text-neutral-600" };
  }
}

/** Rustige priority-strip: weinig randen, hiërarchie via type en witruimte. */
export function PriorityRail({ items }: { items: OpsPrioritySignal[] }) {
  return (
    <section id="prioriteiten" aria-label="Prioriteiten" className="scroll-mt-8">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Prioriteiten</h2>
        <span className="text-[11px] text-neutral-400">
          Regels: churn, live+betaling, deals vast in fase, betalingen, sites, leads
        </span>
      </div>
      <div className="sales-os-priority-shell flex flex-col divide-y divide-neutral-100 rounded-xl bg-neutral-50/40 py-1 ring-1 ring-neutral-950/[0.04] dark:divide-zinc-700/80 dark:bg-zinc-900/50 dark:ring-white/10">
        {items.map((p) => {
          const st = severityStyles(p.severity);
          return (
            <div
              key={p.id}
              className="group flex flex-col gap-1.5 px-3 py-2.5 transition-colors hover:bg-white/60 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                <div className={cn("mt-0.5 h-8 w-0.5 shrink-0 rounded-full", st.bar)} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{p.title}</p>
                  <p className="mt-1 text-[13px] leading-snug text-neutral-700">{p.detail}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 pl-3 sm:pl-0">
                <span className={cn("text-[10px] font-semibold uppercase tracking-wide", st.label)}>
                  {p.severity === "critical" ? "Kritiek" : p.severity === "attention" ? "Let op" : "Gezond"}
                </span>
                <Link
                  href={p.href}
                  className="text-[12px] font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-900"
                >
                  {p.actionLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

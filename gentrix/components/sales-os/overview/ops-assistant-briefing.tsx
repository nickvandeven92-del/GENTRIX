import Link from "next/link";
import type { AssistantBriefing } from "@/lib/sales-os/assistant-briefing";
import { Sparkles } from "lucide-react";

export function OpsAssistantBriefing({ briefing }: { briefing: AssistantBriefing }) {
  return (
    <aside
      id="assistent"
      aria-label="Dagelijkse assistent-samenvatting"
      className="scroll-mt-8 rounded-lg bg-gradient-to-br from-neutral-50 to-neutral-100/80 px-3 py-3 ring-1 ring-neutral-950/[0.06] sm:px-4"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-white">
            <Sparkles className="size-3.5 opacity-95" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Assistent</p>
            <p className="text-pretty text-[13px] leading-relaxed text-neutral-800">{briefing.summary}</p>
            {briefing.weekLine ? (
              <p className="text-pretty border-t border-neutral-200/80 pt-2 text-[12px] leading-relaxed text-neutral-600">
                {briefing.weekLine}
              </p>
            ) : null}
          </div>
        </div>
        <nav
          className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end"
          aria-label="Snel naar secties"
        >
          {briefing.jumpLinks.map((j) => (
            <Link
              key={j.href}
              href={j.href}
              className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-neutral-800 ring-1 ring-neutral-950/[0.08] transition-colors hover:bg-white hover:ring-neutral-950/[0.14]"
            >
              {j.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

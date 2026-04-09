import type { Metadata } from "next";
import Link from "next/link";
import { CreateDealForm } from "@/components/sales-os/deals/create-deal-form";
import { listSalesDeals } from "@/lib/data/sales-deals";
import { formatEURFromCents } from "@/lib/sales-os/format-money";
import { DEAL_STAGE_LABELS } from "@/lib/sales-os/deal-stages";
import { effectiveDealNextStepMessage } from "@/lib/sales-os/deal-step-log";

export const metadata: Metadata = {
  title: "Deals",
};

export default async function SalesOpsDealsPage() {
  const deals = await listSalesDeals();

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <CreateDealForm />
      {deals.length === 0 ? (
        <p className="text-sm text-neutral-500">Nog geen deals in sales_deals — maak er een aan.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((d) => (
            <Link
              key={d.id}
              href={`/admin/ops/deals/${d.id}`}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-300"
            >
              <p className="font-medium text-neutral-900">{d.company_name}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900">
                {formatEURFromCents(d.value_cents)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">{DEAL_STAGE_LABELS[d.stage]}</p>
              <p className="mt-1 line-clamp-2 text-[11px] text-neutral-600">
                {effectiveDealNextStepMessage(d) ?? "—"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

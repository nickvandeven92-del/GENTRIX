import type { Metadata } from "next";
import { WebsiteProductionBoard } from "@/components/sales-os/overview/website-production-board";
import Link from "next/link";
import { listWebsiteOpsWithClients } from "@/lib/data/website-ops";

export const metadata: Metadata = {
  title: "Websites",
};

export default async function SalesOpsWebsitesPage() {
  const items = await listWebsiteOpsWithClients();

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-600">
        <p className="leading-snug">Volledig fase-bord (briefing → live).</p>
        <p className="flex shrink-0 flex-wrap gap-x-2 font-medium">
          <Link href="/admin/ops/studio" className="text-neutral-900 underline-offset-2 hover:underline">
            Site-studio
          </Link>
          <span className="text-neutral-300" aria-hidden>
            ·
          </span>
          <Link href="/admin/sites" className="text-neutral-900 underline-offset-2 hover:underline">
            Alle sites
          </Link>
        </p>
      </div>
      <WebsiteProductionBoard items={items} />
    </div>
  );
}

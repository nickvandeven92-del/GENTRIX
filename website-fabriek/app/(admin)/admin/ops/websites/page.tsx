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
    <div className="mx-auto max-w-[1400px] space-y-6">
      <p className="text-[11px] text-neutral-500">
        Operationele status uit <code className="text-neutral-600">website_ops_state</code>. Publiceren gebruikt de
        bestaande publish-API (geen wijziging aan de AI-engine).
      </p>
      <p className="text-sm">
        <Link href="/admin/ops/studio" className="font-medium text-neutral-900 underline-offset-2 hover:underline">
          Site-studio
        </Link>
        {" · "}
        <Link href="/admin/sites" className="font-medium text-neutral-900 underline-offset-2 hover:underline">
          Alle sites
        </Link>
      </p>
      <WebsiteProductionBoard items={items} />
    </div>
  );
}

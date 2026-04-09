import type { Metadata } from "next";
import Link from "next/link";
import { listAdminClients } from "@/lib/data/list-admin-clients";
import { listWebsiteOpsWithClients } from "@/lib/data/website-ops";
import { buildClientHealthRows } from "@/lib/sales-os/build-client-health-rows";
import type { ChurnRiskLevel } from "@/lib/sales-os/scoring";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Klanten — Sales OS",
};

function churnNl(r: ChurnRiskLevel) {
  if (r === "high") return "Hoog";
  if (r === "med") return "Middel";
  return "Laag";
}

export default async function SalesOpsClientsPage() {
  const [clients, websiteOps] = await Promise.all([listAdminClients(), listWebsiteOpsWithClients()]);
  const opsBy = new Map(websiteOps.map((o) => [o.client_id, o]));
  const rows = buildClientHealthRows(clients, opsBy);
  const sorted = [...rows].sort((a, b) => {
    const r = { high: 0, med: 1, low: 2 };
    const d = r[a.churnRisk] - r[b.churnRisk];
    if (d !== 0) return d;
    return b.health - a.health;
  });

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <p className="text-[11px] text-neutral-500">
        Zelfde klanten als in de database; health-score is een deterministische regel in{" "}
        <code className="text-neutral-600">lib/sales-os/scoring.ts</code>.
      </p>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-3 py-2">Klant</th>
              <th className="px-3 py-2">Website</th>
              <th className="px-3 py-2">Betaling</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Churn</th>
              <th className="px-3 py-2 text-right">Actie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sorted.map((r) => (
              <tr key={r.id} className="text-neutral-800">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-xs text-neutral-600">{r.websiteStatus}</td>
                <td className="px-3 py-2 text-xs">{r.payment}</td>
                <td className="px-3 py-2 tabular-nums">{r.health}</td>
                <td className={cn("px-3 py-2 text-xs font-medium", riskClass(r.churnRisk))}>{churnNl(r.churnRisk)}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/ops/clients/${encodeURIComponent(r.slug)}`}
                    className="text-xs font-semibold text-neutral-900 underline-offset-2 hover:underline"
                  >
                    Sales-dossier
                  </Link>
                  {" · "}
                  <Link
                    href={`/admin/clients/${encodeURIComponent(r.slug)}`}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    Klassiek
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function riskClass(r: ChurnRiskLevel) {
  if (r === "high") return "text-rose-600";
  if (r === "med") return "text-amber-600";
  return "text-emerald-600";
}

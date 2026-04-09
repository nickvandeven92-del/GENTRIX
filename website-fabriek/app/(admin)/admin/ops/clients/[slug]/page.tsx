import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientTasksMini } from "@/components/sales-os/clients/client-tasks-mini";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { listSalesDealsForClient } from "@/lib/data/sales-deals";
import { listSalesTasksForLinked } from "@/lib/data/sales-tasks";
import { getWebsiteOpsByClientId } from "@/lib/data/website-ops";
import { formatEURFromCents } from "@/lib/sales-os/format-money";
import {
  getChurnRiskLevel,
  getClientHealthScore,
  getUpsellHint,
} from "@/lib/sales-os/scoring";
import { PLAN_TYPE_LABELS, type PlanType } from "@/lib/commercial/client-commercial";
import { DEAL_STAGE_LABELS } from "@/lib/sales-os/deal-stages";
import type { SalesDealStage } from "@/lib/sales-os/deal-stages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug));
  return { title: row ? `${row.name} — Sales` : "Klant" };
}

function churnNl(churn: string) {
  if (churn === "high") return "Hoog";
  if (churn === "med") return "Middel";
  if (churn === "low") return "Laag";
  return churn;
}

export default async function SalesOpsClientDetailPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const row = await getClientCommercialBySlug(slug);
  if (!row) notFound();

  const [deals, tasks, ops] = await Promise.all([
    listSalesDealsForClient(row.id),
    listSalesTasksForLinked("client", row.id),
    getWebsiteOpsByClientId(row.id),
  ]);

  const healthInput = {
    id: row.id,
    name: row.name,
    subfolder_slug: row.subfolder_slug,
    status: row.status,
    updated_at: row.updated_at,
    generation_package: row.generation_package,
    plan_type: row.plan_type,
    plan_label: row.plan_label,
    payment_status: row.payment_status,
    pipeline_stage: row.pipeline_stage,
    subscription_renews_at: row.subscription_renews_at,
    billing_email: row.billing_email,
    custom_domain: row.custom_domain,
    client_number: row.client_number,
  };

  const health = getClientHealthScore(healthInput);
  const churn = getChurnRiskLevel(healthInput);
  const upsell = getUpsellHint(healthInput);

  const planLabel =
    row.plan_type && row.plan_type in PLAN_TYPE_LABELS
      ? PLAN_TYPE_LABELS[row.plan_type as PlanType]
      : row.plan_label ?? "—";

  const card = "rounded-lg border border-neutral-200 bg-white p-5";
  const linkBtn =
    "rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 hover:border-neutral-300 hover:bg-neutral-50";

  return (
    <div className="mx-auto max-w-[1000px] space-y-8 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{row.name}</h1>
          <p className="mt-1 font-mono text-xs text-neutral-500">{row.subfolder_slug}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href={`/admin/clients/${encodeURIComponent(slug)}/commercial`} className={linkBtn}>
            Facturatie (klassiek)
          </Link>
          <Link href={`/admin/editor/${encodeURIComponent(slug)}`} className={linkBtn}>
            Editor
          </Link>
          <Link href={`/site/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer" className={linkBtn}>
            Live site
          </Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2 text-[11px]">
        {(
          [
            ["Overzicht", ""],
            ["Websites", " (stub)"],
            ["Facturatie", " (stub)"],
            ["Communicatie", " (stub)"],
            ["Taken", ""],
            ["Kansen", ""],
          ] as const
        ).map(([tab, stub]) => (
          <span key={tab} className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-600">
            {tab}
            {stub}
          </span>
        ))}
      </nav>

      <section id="overview" className={card}>
        <h2 className="text-sm font-semibold text-neutral-900">Overzicht</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Status site</dt>
            <dd className="text-sm text-slate-800">{row.status}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-neutral-500">Betaling</dt>
            <dd className="text-sm text-neutral-800">{row.payment_status}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-neutral-500">Plan</dt>
            <dd className="text-sm text-neutral-800">{planLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-neutral-500">Verlenging</dt>
            <dd className="text-sm text-neutral-800">
              {row.subscription_renews_at
                ? new Date(row.subscription_renews_at).toLocaleDateString("nl-NL")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-neutral-500">Health score</dt>
            <dd className="text-sm font-semibold tabular-nums text-neutral-900">{health}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-neutral-500">Churn-risico</dt>
            <dd className="text-sm font-medium text-neutral-800">{churnNl(churn)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase text-neutral-500">Upsell-hint</dt>
            <dd className="text-sm text-neutral-600">{upsell}</dd>
          </div>
        </dl>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-neutral-900">Websites (ops)</h2>
        {ops ? (
          <dl className="mt-3 grid gap-2 text-sm text-neutral-700">
            <div>
              <span className="text-neutral-500">Leveringsstatus: </span>
              {ops.ops_status}
            </div>
            <div>
              <span className="text-neutral-500">Review: </span>
              {ops.review_status}
            </div>
            <div>
              <span className="text-neutral-500">Blokkade: </span>
              {ops.blocker_status}
            </div>
            <div>
              <span className="text-neutral-500">Publicatie klaar: </span>
              {ops.publish_ready ? "ja" : "nee"}
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">Geen website_ops_state (migratie uitvoeren).</p>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-neutral-900">Kansen (deals)</h2>
        {deals.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Geen deals gekoppeld aan client_id.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {deals.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/ops/deals/${d.id}`} className="text-sm text-neutral-900 underline-offset-2 hover:underline">
                  {d.company_name} — {formatEURFromCents(d.value_cents)} (
                  {DEAL_STAGE_LABELS[d.stage as SalesDealStage]})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-neutral-900">Taken</h2>
        <div className="mt-3">
          <ClientTasksMini tasks={tasks} />
        </div>
      </section>
    </div>
  );
}

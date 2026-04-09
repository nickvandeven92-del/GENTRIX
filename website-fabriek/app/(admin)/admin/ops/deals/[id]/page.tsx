import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DealDetailClient } from "@/components/sales-os/deals/deal-detail-client";
import { getSalesDealById } from "@/lib/data/sales-deals";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const d = await getSalesDealById(id);
  return { title: d ? d.company_name : "Deal" };
}

export default async function SalesOpsDealDetailPage({ params }: Props) {
  const { id } = await params;
  const deal = await getSalesDealById(id);
  if (!deal) notFound();
  return <DealDetailClient deal={deal} />;
}

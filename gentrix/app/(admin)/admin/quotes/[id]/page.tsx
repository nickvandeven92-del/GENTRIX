import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuoteWorkspace } from "@/components/admin/billing/quote-workspace";
import { getQuoteById } from "@/lib/data/get-quote-by-id";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const q = await getQuoteById(id);
  return { title: q ? q.quote_number : "Offerte" };
}

export default async function AdminQuoteDocumentPage({ params }: Props) {
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();

  return <QuoteWorkspace initialQuote={quote} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getQuoteById } from "@/lib/data/get-quote-by-id";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const q = await getQuoteById(id);
  return { title: q ? `Bewerken · ${q.quote_number}` : "Offerte" };
}

/** Bewerken gebeurt op de hoofdpagina van de offerte (viewer + formulier). */
export default async function AdminQuoteEditPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/quotes/${id}`);
}

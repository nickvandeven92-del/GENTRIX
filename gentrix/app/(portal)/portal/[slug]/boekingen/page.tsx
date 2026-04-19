import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getActivePortalClient } from "@/lib/data/get-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c) return { title: "Boekingen" };
  return { title: `Agenda — ${c.name}` };
}

/** Boekingenbeheer staat op `/agenda/{slug}` (zelfde login, apart scherm). */
export default async function PortalBookingsRedirectPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const client = await getActivePortalClient(decoded);
  if (!client || !client.appointments_enabled) notFound();

  redirect(`/agenda/${encodeURIComponent(decoded)}`);
}

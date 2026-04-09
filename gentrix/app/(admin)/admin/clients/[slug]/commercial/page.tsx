import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientCommercialForm } from "@/components/admin/client-commercial-form";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Commercie" };
  return { title: `Commercie — ${row.name}` };
}

export default async function ClientCommercialPage({ params }: PageProps) {
  const { slug } = await params;
  if (!slug) notFound();

  const row = await getClientCommercialBySlug(decodeURIComponent(slug));
  if (!row) notFound();

  return (
    <div className="pb-8">
      <ClientCommercialForm initial={row} />
    </div>
  );
}

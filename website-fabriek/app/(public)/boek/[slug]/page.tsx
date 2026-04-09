import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicBookingForm } from "@/components/public/public-booking-form";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok || !resolved.appointmentsEnabled) {
    return { title: "Boeken" };
  }
  return { title: `Afspraak — ${resolved.name}` };
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok || !resolved.appointmentsEnabled) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <PublicBookingForm slug={slug} businessName={resolved.name} />
    </div>
  );
}

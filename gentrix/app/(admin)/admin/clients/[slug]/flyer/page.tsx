import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ slug: string }> };

/** Flyer & QR zit onder /admin/flyers/[slug], los van het klantdossier. */
export default async function ClientFlyerRedirectPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  if (!slug) redirect("/admin/flyers");
  redirect(`/admin/flyers/${encodeURIComponent(slug)}`);
}

import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

/** Oude route → gecombineerde Boekingen-hub. */
export default async function PortalAppointmentsRedirectPage({ params }: Props) {
  const { slug } = await params;
  const enc = encodeURIComponent(decodeURIComponent(slug));
  redirect(`/agenda/${enc}?tab=afspraken`);
}

import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

/** Oude route → gecombineerde Boekingen-hub. */
export default async function PortalAppointmentsRedirectPage({ params }: Props) {
  const { slug } = await params;
  const enc = encodeURIComponent(decodeURIComponent(slug));
  redirect(`/portal/${enc}/boekingen?tab=afspraken`);
}

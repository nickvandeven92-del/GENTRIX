import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function PortalPlanningRedirectPage({ params }: Props) {
  const { slug } = await params;
  const enc = encodeURIComponent(decodeURIComponent(slug));
  redirect(`/portal/${enc}/boekingen?tab=planning`);
}

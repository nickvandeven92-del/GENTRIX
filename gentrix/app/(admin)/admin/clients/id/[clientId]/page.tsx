import { notFound, redirect } from "next/navigation";
import { getClientSubfolderSlugById } from "@/lib/data/get-client-row-by-id";

type Props = { params: Promise<{ clientId: string }> };

/** Zorgt dat een link op basis van intern id naar het dossier op slug-route gaat. */
export default async function ClientIdRedirectPage({ params }: Props) {
  const { clientId } = await params;
  if (!clientId) notFound();
  const slug = await getClientSubfolderSlugById(clientId);
  if (!slug) notFound();
  redirect(`/admin/clients/${encodeURIComponent(slug)}`);
}

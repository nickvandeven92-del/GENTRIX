import { notFound, redirect } from "next/navigation";
import { AgendaPinGate } from "@/components/agenda/agenda-pin-gate";
import { AgendaShell } from "@/components/agenda/agenda-shell";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
import { getRequestOrigin } from "@/lib/site/request-origin";
import { canAccessPortalForUserId } from "@/lib/portal/studio-portal-preview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicLiveBookingHref } from "@/lib/site/studio-section-visibility";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export default async function AgendaSlugLayout({ children, params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const client = await getActivePortalClient(decoded);
  if (!client || !client.appointments_enabled) notFound();

  const enc = encodeURIComponent(decoded);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/agenda/${enc}`)}`);
  }

  if (!canAccessPortalForUserId(client.portal_user_id, user.id)) {
    redirect(`/admin/portal-geen-toegang?slug=${enc}`);
  }

  const origin = await getRequestOrigin();
  const bookingPath = publicLiveBookingHref(decoded);
  const publicBookingHref = origin ? `${origin}${bookingPath}` : bookingPath;

  return (
    <AgendaShell
      slug={slug}
      clientName={client.name}
      clientId={client.id}
      publicBookingHref={publicBookingHref}
      appointmentsEnabled={client.appointments_enabled}
    >
      <AgendaPinGate clientId={client.id} slug={slug}>
        {children}
      </AgendaPinGate>
    </AgendaShell>
  );
}

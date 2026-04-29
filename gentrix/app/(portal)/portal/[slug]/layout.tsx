import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
import { getRequestOrigin } from "@/lib/site/request-origin";
import { isPortalStrictAccessEnabled } from "@/lib/portal/portal-access-policy";
import {
  canAccessPortalForUserId,
  isStudioPortalPreview,
} from "@/lib/portal/studio-portal-preview";
import { getPortalSupportUnreadSummary } from "@/lib/data/portal-support-unread";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function PortalSlugLayout({ children, params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const client = await getActivePortalClient(decodeURIComponent(slug));
  if (!client) notFound();

  const enc = encodeURIComponent(decodeURIComponent(slug));

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/portal/${enc}`)}`);
  }

  if (!canAccessPortalForUserId(client.portal_user_id, user.id)) {
    redirect(`/admin/portal-geen-toegang?slug=${enc}`);
  }

  const portalSessionMismatch = await isStudioPortalPreview(client.portal_user_id);
  const showStudioPreviewBanner = portalSessionMismatch && isPortalStrictAccessEnabled();

  const origin = await getRequestOrigin();
  const publicSiteAbsoluteUrl = origin ? `${origin}/site/${enc}` : undefined;

  const decodedSlug = decodeURIComponent(slug);

  const supportUnread = await getPortalSupportUnreadSummary(client.id);

  return (
    <PortalShell
      slug={slug}
      clientName={client.name}
      appointmentsEnabled={client.appointments_enabled}
      invoicesEnabled={client.portal_invoices_enabled}
      accountEnabled={client.portal_account_enabled}
      supportUnreadInitial={supportUnread.totalUnreadStaffMessages}
      publicSiteAbsoluteUrl={publicSiteAbsoluteUrl}
      portalSessionMismatch={portalSessionMismatch}
      showStudioPreviewBanner={showStudioPreviewBanner}
    >
      {children}
    </PortalShell>
  );
}

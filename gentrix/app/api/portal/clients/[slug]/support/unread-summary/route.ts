import { NextResponse } from "next/server";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { getPortalSupportUnreadSummary } from "@/lib/data/portal-support-unread";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:support:unread:${slug}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const summary = await getPortalSupportUnreadSummary(access.clientId);
  return NextResponse.json({
    ok: true,
    totalUnreadStaffMessages: summary.totalUnreadStaffMessages,
    openThreadsWithUnread: summary.openThreadsWithUnread,
  });
}

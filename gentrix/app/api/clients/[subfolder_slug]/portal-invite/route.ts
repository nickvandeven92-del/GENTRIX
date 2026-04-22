import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { isValidSubfolderSlug } from "@/lib/slug";
import { sendPortalInviteForClientSlug } from "@/lib/portal/portal-invite";

const bodySchema = z.object({
  resend: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  let resend = false;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) resend = Boolean(parsed.data.resend);
  } catch {
    /* lege body ok */
  }

  try {
    const result = await sendPortalInviteForClientSlug(subfolder_slug, { forceResend: resend });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    if (result.status === "skipped") {
      return NextResponse.json({
        ok: true,
        portal_invite: {
          status: "skipped" as const,
          reason: result.reason,
        },
      });
    }
    return NextResponse.json({
      ok: true,
      portal_invite: {
        status: "sent" as const,
        email: result.email,
        email_dispatched: result.emailDispatched,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt (server-only)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

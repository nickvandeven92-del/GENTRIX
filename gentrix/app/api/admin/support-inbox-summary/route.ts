import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { listAwaitingSupportReplyRows } from "@/lib/support/admin-support-inbox";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Studio: open support-threads die wachten op antwoord (laatste bericht = klant).
 * Optioneel `?slug=` voor de site-studio / huidige klant-context.
 */
export async function GET(request: Request) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const rawSlug = url.searchParams.get("slug")?.trim() ?? "";
  const slug = rawSlug ? decodeURIComponent(rawSlug) : "";
  if (slug && !isValidSubfolderSlug(slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const all = await listAwaitingSupportReplyRows(supabase, { maxThreads: 300 });
  const forSlug = slug ? all.filter((r) => r.subfolder_slug === slug) : [];

  return NextResponse.json({
    ok: true,
    totalAwaiting: all.length,
    slugAwaiting: forSlug.length,
    items: all.slice(0, 25).map((r) => ({
      threadId: r.threadId,
      subfolder_slug: r.subfolder_slug,
      subject: r.subject,
      updated_at: r.updated_at,
    })),
    slugItems: forSlug.slice(0, 15).map((r) => ({
      threadId: r.threadId,
      subject: r.subject,
      updated_at: r.updated_at,
    })),
  });
}

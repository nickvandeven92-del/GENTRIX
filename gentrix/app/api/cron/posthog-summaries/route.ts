import { NextResponse } from "next/server";
import { syncAllClientPosthogSummaries } from "@/lib/data/sync-client-posthog-summaries";

/**
 * Vult `client_posthog_summary` per klant (PostHog → Supabase). Beveiliging: Authorization: Bearer $CRON_SECRET.
 * Stel `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` in; anders sync slaat over / schrijft fouten.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const res = await syncAllClientPosthogSummaries();
  return NextResponse.json({ ok: res.ok, updated: res.updated, skipped: res.skipped, errors: res.errors });
}

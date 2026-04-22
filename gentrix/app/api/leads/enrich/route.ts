import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { upsertKvkEnrichedLead } from "@/lib/data/kvk-enriched-leads";
import { KvkApiError } from "@/lib/kvk/client";
import { leadEnrichBodySchema } from "@/lib/leads/kvk-enrichment-schemas";
import { runLeadEnrichment } from "@/lib/leads/enrich-pipeline";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = leadEnrichBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const payload = await runLeadEnrichment({
      kvkNummer: parsed.data.kvkNummer,
      manualWebsiteUrl: parsed.data.manualWebsiteUrl,
    });

    let saved = null;
    try {
      saved = await upsertKvkEnrichedLead(payload);
    } catch (dbErr) {
      console.error("[api/leads/enrich] db upsert failed", dbErr);
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...payload,
        savedRow: saved,
      },
    });
  } catch (e) {
    if (e instanceof KvkApiError) {
      console.warn("[api/leads/enrich]", e.status, e.message);
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status >= 500 ? 502 : e.status });
    }
    if (e instanceof Error && e.message.includes("KVK_API_KEY")) {
      return NextResponse.json({ ok: false, error: "KVK API niet geconfigureerd (KVK_API_KEY)." }, { status: 503 });
    }
    console.error("[api/leads/enrich]", e);
    return NextResponse.json({ ok: false, error: "Enrichment mislukt." }, { status: 500 });
  }
}

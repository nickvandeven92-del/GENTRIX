import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { getBasisprofiel, getVestigingenList, KvkApiError } from "@/lib/kvk/client";
import { mapBasisprofielToProfile } from "@/lib/kvk/mappers";
import { kvkProfileQuerySchema } from "@/lib/leads/kvk-enrichment-schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige URL." }, { status: 400 });
  }

  const parsed = kvkProfileQuerySchema.safeParse({ kvk: url.searchParams.get("kvk") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten().fieldErrors.kvk?.[0] ?? "Ongeldig KVK-nummer." },
      { status: 400 },
    );
  }

  try {
    const [basis, vestigingen] = await Promise.all([
      getBasisprofiel(parsed.data.kvk),
      getVestigingenList(parsed.data.kvk),
    ]);
    const profile = mapBasisprofielToProfile(basis, vestigingen);
    return NextResponse.json({ ok: true, data: profile });
  } catch (e) {
    if (e instanceof KvkApiError) {
      console.warn("[api/kvk/profile]", e.status, e.message);
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status >= 500 ? 502 : e.status });
    }
    if (e instanceof Error && e.message.includes("KVK_API_KEY")) {
      return NextResponse.json({ ok: false, error: "KVK API niet geconfigureerd (KVK_API_KEY)." }, { status: 503 });
    }
    console.error("[api/kvk/profile]", e);
    return NextResponse.json({ ok: false, error: "Onverwachte fout bij basisprofiel." }, { status: 500 });
  }
}

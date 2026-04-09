import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { searchCompanies, KvkApiError } from "@/lib/kvk/client";
import { mapZoekenItem } from "@/lib/kvk/mappers";
import { kvkSearchQuerySchema } from "@/lib/leads/kvk-enrichment-schemas";

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

  const raw = {
    q: url.searchParams.get("q") ?? "",
    plaats: url.searchParams.get("plaats") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    pagina: url.searchParams.get("pagina") ?? undefined,
    resultatenPerPagina: url.searchParams.get("resultatenPerPagina") ?? undefined,
  };

  const parsed = kvkSearchQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { q, plaats, type, pagina, resultatenPerPagina } = parsed.data;

  try {
    const res = await searchCompanies(q, {
      plaats,
      type,
      pagina,
      resultatenPerPagina,
    });
    const items = (res.resultaten ?? []).map((item, i) => mapZoekenItem(item, i));
    return NextResponse.json({
      ok: true,
      data: {
        items,
        pagina: res.pagina ?? pagina,
        resultatenPerPagina: res.resultatenPerPagina ?? resultatenPerPagina,
        totaal: res.totaal ?? items.length,
      },
    });
  } catch (e) {
    if (e instanceof KvkApiError) {
      console.warn("[api/kvk/search]", e.status, e.message);
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status >= 500 ? 502 : e.status });
    }
    if (e instanceof Error && e.message.includes("KVK_API_KEY")) {
      return NextResponse.json({ ok: false, error: "KVK API niet geconfigureerd (KVK_API_KEY)." }, { status: 503 });
    }
    console.error("[api/kvk/search]", e);
    return NextResponse.json({ ok: false, error: "Onverwachte fout bij KVK-zoeken." }, { status: 500 });
  }
}

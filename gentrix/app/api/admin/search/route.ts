import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { searchAdminClients } from "@/lib/data/admin-search-clients";

export async function GET(request: Request) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchAdminClients(q, 25);
  return NextResponse.json({ ok: true, results });
}

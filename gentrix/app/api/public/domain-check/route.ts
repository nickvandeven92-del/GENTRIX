import { NextResponse } from "next/server";
import { checkDomainAvailabilityHint } from "@/lib/domains/rdap-domain-check";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain") ?? "";
  const result = await checkDomainAvailabilityHint(domain);
  return NextResponse.json({ ok: true, ...result });
}

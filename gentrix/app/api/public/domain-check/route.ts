import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/api/public-rate-limit";
import { extractClientIp } from "@/lib/api/request-client-ip";
import { checkDomainAvailabilityHint } from "@/lib/domains/rdap-domain-check";

export async function GET(request: Request) {
  const ip = extractClientIp(request.headers);
  if (!checkPublicRateLimit(ip, "domain-check", 20)) {
    return NextResponse.json(
      { ok: false as const, error: "Te veel domein-checks. Probeer zo opnieuw." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain") ?? "";
  const result = await checkDomainAvailabilityHint(domain);
  return NextResponse.json({ ok: true, ...result });
}

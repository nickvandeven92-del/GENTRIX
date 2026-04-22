import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/api/public-rate-limit";
import { extractClientIp } from "@/lib/api/request-client-ip";
import { pdokLookupNlAddress } from "@/lib/nl-address/pdok-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = extractClientIp(request.headers);
  if (!checkPublicRateLimit(ip, "nl-address", 30)) {
    return NextResponse.json(
      { ok: false as const, error: "Te veel adres-verzoeken. Probeer zo opnieuw." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get("postcode") ?? "";
  const huisnummer = searchParams.get("huisnummer") ?? "";
  const toevoeging = searchParams.get("toevoeging") ?? "";

  if (!postcode.trim() || !huisnummer.trim()) {
    return NextResponse.json({ ok: false as const, error: "Postcode en huisnummer zijn verplicht." }, { status: 400 });
  }

  const result = await pdokLookupNlAddress({
    postcode,
    houseNumberInput: huisnummer,
    suffix: toevoeging.trim() || undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false as const, error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true as const,
    address: {
      street: result.address.street,
      city: result.address.city,
      postalCode: result.address.postalCode,
      houseNumber: result.address.houseNumber,
      houseLetter: result.address.houseLetter,
      houseNumberAddition: result.address.houseNumberAddition,
      displayLine: result.address.displayLine,
    },
  });
}

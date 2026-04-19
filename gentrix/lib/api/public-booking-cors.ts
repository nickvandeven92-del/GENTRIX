import { NextResponse } from "next/server";

/**
 * Komma- of newline-gescheiden `Origin`-waarden die `GET`/`POST` op de publieke
 * boek-API’s (`/api/public/clients/[slug]/booking-*`, `…/appointments`) cross-origin mogen aanroepen
 * (bijv. Vite SPA op `https://booking.jouwdomein.nl`).
 *
 * Lokaal: gebruik liever Vite `server.proxy` naar Next — dan is CORS niet nodig.
 */
export function parseBookingViteCorsOrigins(): string[] {
  const raw =
    process.env.BOOKING_VITE_PUBLIC_ORIGINS?.trim() ||
    process.env.NEXT_PUBLIC_BOOKING_VITE_ORIGINS?.trim() ||
    "";
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function bookingViteCorsHeaders(request: Request): Record<string, string> | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const allowed = parseBookingViteCorsOrigins();
  if (allowed.length === 0 || !allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export function withPublicBookingCors(request: Request, res: NextResponse): NextResponse {
  const extra = bookingViteCorsHeaders(request);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      res.headers.set(k, v);
    }
  }
  return res;
}

export function jsonWithMaybeCors(request: Request, body: unknown, init?: ResponseInit): NextResponse {
  return withPublicBookingCors(request, NextResponse.json(body, init));
}

/** Preflight: alleen nuttig als `BOOKING_VITE_PUBLIC_ORIGINS` de aanvragende `Origin` bevat. */
export function bookingVitePreflightResponse(request: Request): NextResponse {
  const extra = bookingViteCorsHeaders(request);
  if (!extra) {
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(null, { status: 204, headers: extra });
}

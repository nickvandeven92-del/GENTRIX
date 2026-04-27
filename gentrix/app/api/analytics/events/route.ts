import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  analyticsIngestMaxRequestsPerWindow,
  analyticsIngestWindowMs,
  capEventPropertiesSize,
  getRequestIpForRateLimit,
  hashUserAgentForStorage,
  isAnalyticsIngestOverRateLimit,
  refererForStorage,
} from "@/lib/api/analytics-ingest-helpers";

const MAX_EVENTS = 32;
const MAX_SLUG = 200;
const MAX_ID = 80;
const MAX_BODY_BYTES = 256 * 1024;

const ALLOWED_TYPES = new Set([
  "page_view",
  "click_event",
  "conversion_event",
  "scroll_depth",
  "engagement_ping",
]);

type IncomingEvent = {
  event_type?: string;
  page_path?: string | null;
  page_key?: string | null;
  visitor_id?: string | null;
  session_id?: string | null;
  properties?: Record<string, unknown> | null;
};

function trimStr(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function sanitizeId(s: string | null | undefined): string {
  const t = trimStr(s, MAX_ID);
  return t && t.length > 0 ? t : "unknown";
}

function stripForbiddenKeysFromProperties(raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k0, v] of Object.entries(raw)) {
    const k = k0.slice(0, 64);
    if (k.toLowerCase() === "client_id") continue;
    out[k] = v;
  }
  return out;
}

function sanitizeProperties(
  raw: Record<string, unknown> | null | undefined,
  stripKeys: string[],
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!raw || typeof raw !== "object") return out;
  const strip = new Set([...stripKeys, "client_id", "Client_ID"]);
  for (const [k0, v] of Object.entries(raw)) {
    if (strip.has(k0)) continue;
    const k = k0.slice(0, 64);
    if (k.toLowerCase() === "client_id") continue;
    if (typeof v === "string") {
      out[k] = v.length > 1024 ? v.slice(0, 1024) : v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

function deviceClassFromUa(ua: string | null): "mobile" | "desktop" | "tablet" | "unknown" {
  if (!ua) return "unknown";
  if (/Tablet|iPad|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Publieke ingest: `client_id` alleen server-side uit `site_slug` (clients.subfolder_slug).
 * Rate limit, property-size cap, geen volledige UA in DB. Ruwe IP alleen in-memory rate limit, niet in DB.
 */
export async function POST(request: Request) {
  const ip = getRequestIpForRateLimit(request);
  if (
    isAnalyticsIngestOverRateLimit(
      `analytics:ip:${ip}`,
      analyticsIngestMaxRequestsPerWindow(),
      analyticsIngestWindowMs(),
    )
  ) {
    return new NextResponse(null, { status: 429, headers: { "Retry-After": "60" } });
  }

  const cl = request.headers.get("content-length");
  if (cl != null && cl !== "" && /^\d+$/.test(cl)) {
    const n = Number.parseInt(cl, 10);
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
  }

  let siteSlug: string;
  let events: IncomingEvent[];
  try {
    const body = (await request.json()) as { site_slug?: string; events?: IncomingEvent[] };
    siteSlug = String(body.site_slug ?? "").trim();
    if (!siteSlug || siteSlug.length > MAX_SLUG) {
      return new NextResponse(null, { status: 204 });
    }
    if (!Array.isArray(body.events) || body.events.length === 0) {
      return new NextResponse(null, { status: 204 });
    }
    events = body.events.slice(0, MAX_EVENTS);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("id, status")
      .eq("subfolder_slug", siteSlug)
      .maybeSingle();
    if (clientErr || !clientRow) {
      return new NextResponse(null, { status: 204 });
    }
    if (String((clientRow as { status: string }).status) === "archived") {
      return new NextResponse(null, { status: 204 });
    }

    const clientId = String((clientRow as { id: string }).id);
    const ua = request.headers.get("user-agent");
    const device = deviceClassFromUa(ua);
    const uaStore = hashUserAgentForStorage(ua);
    const refStore = refererForStorage(request.headers.get("referer"));

    const rows: {
      client_id: string;
      site_slug: string;
      event_type: string;
      visitor_id: string;
      session_id: string;
      page_path: string | null;
      page_key: string | null;
      properties: Record<string, string | number | boolean>;
      user_agent: string | null;
      device_class: "mobile" | "desktop" | "tablet" | "unknown";
      referrer: string | null;
    }[] = [];

    for (const e of events) {
      const t = String(e?.event_type ?? "");
      if (!ALLOWED_TYPES.has(t)) continue;

      const mergedProps = stripForbiddenKeysFromProperties(
        (e && typeof e === "object" ? (e as IncomingEvent).properties : null) as Record<string, unknown> | null,
      );
      const vid = sanitizeId((e?.visitor_id ?? (mergedProps.visitor_id as string) ?? null) as string | null);
      const sid = sanitizeId((e?.session_id ?? (mergedProps.session_id as string) ?? null) as string | null);
      delete mergedProps.visitor_id;
      delete mergedProps.session_id;

      let safeProps = sanitizeProperties(mergedProps, []);
      safeProps = capEventPropertiesSize(safeProps);

      rows.push({
        client_id: clientId,
        site_slug: siteSlug,
        event_type: t,
        visitor_id: vid,
        session_id: sid,
        page_path: trimStr(e?.page_path ?? null, 2000),
        page_key: trimStr(e?.page_key ?? null, 400),
        properties: safeProps,
        user_agent: uaStore,
        device_class: device,
        referrer: refStore,
      });
    }

    if (rows.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const { error: insErr } = await supabase.from("site_analytics_events").insert(rows);
    if (insErr) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[api/analytics/events]", insErr.message);
      }
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ ok: true, accepted: rows.length });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}

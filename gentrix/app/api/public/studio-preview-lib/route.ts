import { NextRequest, NextResponse } from "next/server";
import {
  isStudioPreviewLibName,
  STUDIO_PREVIEW_LIB_UPSTREAM,
} from "@/lib/site/studio-preview-lib-registry";

/**
 * Sandbox-`srcDoc`-iframes hebben origin `null`. Tags met `crossorigin="anonymous"` (AOS/GSAP in
 * `tailwind-page-html`) doen dan een CORS-request naar deze route — zonder ACAO faalt het laden
 * (`net::ERR_FAILED`) en werkt o.a. Alpine/menu niet.
 */
const STUDIO_PREVIEW_LIB_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  /** Laad uit null-origin iframe i.c.m. COEP/CORP op de parent. */
  "Cross-Origin-Resource-Policy": "cross-origin",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...STUDIO_PREVIEW_LIB_CORS_HEADERS } });
}

/**
 * Proxied scripts/styles voor sandboxed studio-iframe (`srcDoc`): zelfde host als de app,
 * zodat o.a. Edge Tracking Prevention geen third-party script-storage op Alpine/Lucide blokkeert.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!isStudioPreviewLibName(name)) {
    return NextResponse.json(
      { error: "Unknown or missing name" },
      { status: 400, headers: { ...STUDIO_PREVIEW_LIB_CORS_HEADERS } },
    );
  }
  const upstream = STUDIO_PREVIEW_LIB_UPSTREAM[name as keyof typeof STUDIO_PREVIEW_LIB_UPSTREAM];
  const res = await fetch(upstream, {
    next: { revalidate: 86_400 },
    headers: { Accept: "*/*" },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream fetch failed" },
      { status: 502, headers: { ...STUDIO_PREVIEW_LIB_CORS_HEADERS } },
    );
  }
  const body = await res.text();
  const isCss = name === "aos-css" || upstream.endsWith(".css");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": isCss ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      ...STUDIO_PREVIEW_LIB_CORS_HEADERS,
    },
  });
}

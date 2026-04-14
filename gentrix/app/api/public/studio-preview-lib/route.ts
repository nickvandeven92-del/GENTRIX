import { NextRequest, NextResponse } from "next/server";
import {
  isStudioPreviewLibName,
  STUDIO_PREVIEW_LIB_UPSTREAM,
} from "@/lib/site/studio-preview-lib-registry";

/**
 * Proxied scripts/styles voor sandboxed studio-iframe (`srcDoc`): zelfde origin als de app,
 * zodat browsers geen third-party storage-blokkade op Alpine/Lucide/AOS/GSAP/Tailwind-play toepassen.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!isStudioPreviewLibName(name)) {
    return NextResponse.json({ error: "Unknown or missing name" }, { status: 400 });
  }
  const upstream = STUDIO_PREVIEW_LIB_UPSTREAM[name as keyof typeof STUDIO_PREVIEW_LIB_UPSTREAM];
  const res = await fetch(upstream, {
    next: { revalidate: 86_400 },
    headers: { Accept: "*/*" },
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  }
  const body = await res.text();
  const isCss = name === "aos-css" || upstream.endsWith(".css");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": isCss ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

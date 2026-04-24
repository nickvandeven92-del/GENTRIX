import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { SITE_ASSETS_UPLOAD_CACHE_CONTROL_MAX_AGE } from "@/lib/site/site-assets-storage-upload";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidSubfolderSlug } from "@/lib/slug";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Hero-loops (o.a. Remotion-export); groter dan logo-afbeeldingen. */
const MAX_VIDEO_BYTES = 35 * 1024 * 1024;

/**
 * SVG is expres niet toegestaan: de bucket serveert public-URLs zonder inline-sanitizer,
 * dus `<script>`-payloads in SVG zouden stored XSS geven. Gebruik PNG/WebP voor iconen.
 */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  return base || "upload";
}

export async function POST(request: Request) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Geen formulierdata." }, { status: 400 });
  }

  const file = form.get("file");
  const slugRaw = form.get("subfolder_slug");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Bestand ontbreekt (veld 'file')." }, { status: 400 });
  }

  const subfolder_slug = typeof slugRaw === "string" ? slugRaw.trim() : "misc";
  if (subfolder_slug !== "misc" && !isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige subfolder_slug." }, { status: 400 });
  }

  const type = file.type || "application/octet-stream";
  const isVideo = VIDEO_TYPES.has(type);
  const isImage = IMAGE_TYPES.has(type);
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { ok: false, error: "Alleen PNG, JPEG, WebP, GIF, MP4 of WebM toegestaan (SVG niet toegestaan)." },
      { status: 400 },
    );
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return NextResponse.json(
      { ok: false, error: `Bestand te groot (max. ${mb} MB voor ${isVideo ? "video" : "afbeelding"}).` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const id = randomBytes(8).toString("hex");
  const path = `${subfolder_slug}/${Date.now()}-${id}-${safeFileName(file.name)}`;

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.storage.from("site-assets").upload(path, buf, {
      contentType: type,
      upsert: false,
      cacheControl: SITE_ASSETS_UPLOAD_CACHE_CONTROL_MAX_AGE,
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error.message.includes("Bucket not found") || error.message.includes("not found")
              ? "Storage-bucket 'site-assets' ontbreekt. Voer de migratie 20260330120000_storage_site_assets.sql uit in Supabase."
              : error.message,
        },
        { status: 500 },
      );
    }

    const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: pub.publicUrl, path });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload mislukt.";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt (server-only)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

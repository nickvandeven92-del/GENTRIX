import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_BYTES = 5 * 1024 * 1024;
/** Claude vision: raster; geen SVG. */
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  return base || "upload";
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth();
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
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Bestand ontbreekt (veld 'file')." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Bestand te groot (max. 5 MB)." }, { status: 400 });
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    return NextResponse.json(
      { ok: false, error: "Alleen PNG, JPEG, WebP of GIF (geen SVG) voor referentie-screenshots." },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const id = randomBytes(8).toString("hex");
  const path = `knowledge-ref/${Date.now()}-${id}-${safeFileName(file.name)}`;

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.storage.from("site-assets").upload(path, buf, {
      contentType: type,
      upsert: false,
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error.message.includes("Bucket not found") || error.message.includes("not found")
              ? "Storage-bucket 'site-assets' ontbreekt. Voer de migratie storage_site_assets uit in Supabase."
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

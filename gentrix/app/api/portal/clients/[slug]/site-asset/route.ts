import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/**
 * SVG wordt bewust geweigerd: de `site-assets`-bucket serveert public-URLs zonder inline
 * sanitizer, dus SVG met `<script>` zou stored XSS opleveren in het klantdomein.
 */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  return base || "upload";
}

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug: rawSlug } = await context.params;
  const slug = decodeURIComponent(rawSlug);

  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  if (!checkPortalRateLimit(access.userId, `portal:site-asset:${slug}`, 12)) {
    return NextResponse.json({ ok: false, error: "Te veel uploads. Probeer het zo opnieuw." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Geen formulierdata." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Bestand ontbreekt." }, { status: 400 });
  }

  if (!IMAGE_TYPES.has(file.type || "")) {
    return NextResponse.json(
      { ok: false, error: "Alleen PNG, JPEG, WebP en GIF zijn toegestaan (SVG niet toegestaan)." },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ ok: false, error: "Bestand te groot. Maximaal 5 MB." }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const id = randomBytes(8).toString("hex");
    const path = `${slug}/${Date.now()}-${id}-${safeFileName(file.name)}`;
    const supabase = createServiceRoleClient();
    const { error } = await supabase.storage.from("site-assets").upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error.message.includes("Bucket not found") || error.message.includes("not found")
              ? "Storage-bucket 'site-assets' ontbreekt. Voer de storage-migratie uit in Supabase."
              : error.message,
        },
        { status: 500 },
      );
    }

    const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl, path });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload mislukt.";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json({ ok: false, error: "Serverconfiguratie ontbreekt." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { tailwindSectionsPayloadSchema } from "@/lib/ai/tailwind-sections-schema";
import { attachCompiledTailwindCssToPayload } from "@/lib/data/tailwind-compiled-css-attach";

/** Zelfde Tailwind CLI-build als bij opslaan / `ensureTailwindCompiledCssOnPublishedPayload` (max ~60s op serverless). */
export const maxDuration = 60;

const bodySchema = z.object({
  documentTitle: z.string().min(1).max(200).optional(),
  payload: tailwindSectionsPayloadSchema,
});

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON-body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const docTitle = parsed.data.documentTitle?.trim() || "Website";
  const { tailwindCompiledCss: _existing, ...payloadWithoutStoredCss } = parsed.data.payload;
  void _existing;

  try {
    const withCss = await attachCompiledTailwindCssToPayload(payloadWithoutStoredCss, docTitle);
    const css = withCss.tailwindCompiledCss?.trim();
    if (!css) {
      return NextResponse.json(
        { ok: false, error: "Tailwind-build leverde geen CSS (controleer secties/logs)." },
        { status: 422 },
      );
    }
    return NextResponse.json({ ok: true, tailwindCompiledCss: css });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

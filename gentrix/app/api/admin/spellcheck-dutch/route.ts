import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { checkDutchSpellingForSectionHtml } from "@/lib/spellcheck/languagetool-nl";

const bodySchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        html: z.string().max(250_000),
      }),
    )
    .min(1)
    .max(60),
});

const MAX_COMBINED_HTML = 600_000;
const MAX_ISSUES_RETURNED = 150;

export async function POST(request: Request) {
  const auth = await requireStudioAdminApiAuth();
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
    const msg = parsed.error.issues.map((i) => i.message).join(" ");
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const combined = parsed.data.sections.reduce((a, s) => a + s.html.length, 0);
  if (combined > MAX_COMBINED_HTML) {
    return NextResponse.json(
      { ok: false, error: "Te veel HTML in één verzoek; splits de controle of verkort secties." },
      { status: 413 },
    );
  }

  try {
    const issues = await checkDutchSpellingForSectionHtml(parsed.data.sections);
    return NextResponse.json({
      ok: true as const,
      issues: issues.slice(0, MAX_ISSUES_RETURNED),
      truncated: issues.length > MAX_ISSUES_RETURNED,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Spellingscontrole mislukt.";
    return NextResponse.json({ ok: false as const, error: message }, { status: 502 });
  }
}

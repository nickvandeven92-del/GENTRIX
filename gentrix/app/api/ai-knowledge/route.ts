import { NextResponse } from "next/server";
import { z } from "zod";
import { aiKnowledgeCategoryZod, KNOWLEDGE_JOURNAL_CATEGORY } from "@/lib/ai/knowledge-categories";
import { zKnowledgeReferenceImageUrls } from "@/lib/ai/knowledge-reference-urls";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const postSchema = z.object({
  category: aiKnowledgeCategoryZod,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(32000),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(-2_147_483_648).max(2_147_483_647).optional(),
  reference_image_urls: zKnowledgeReferenceImageUrls.optional(),
});

export async function GET() {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_knowledge")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  if (parsed.data.category === KNOWLEDGE_JOURNAL_CATEGORY) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Categorie ‘Claude activiteit’ is alleen voor automatische logs. Kies Design, Copywriting, Security, Klant-specifiek of Overig.",
      },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_knowledge")
    .insert({
      category: parsed.data.category,
      title: parsed.data.title,
      body: parsed.data.body,
      is_active: parsed.data.is_active ?? true,
      sort_order: parsed.data.sort_order ?? 0,
      reference_image_urls: parsed.data.reference_image_urls ?? [],
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

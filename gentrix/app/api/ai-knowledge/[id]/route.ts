import { NextResponse } from "next/server";
import { z } from "zod";
import { aiKnowledgeCategoryZod, KNOWLEDGE_JOURNAL_CATEGORY } from "@/lib/ai/knowledge-categories";
import { zKnowledgeReferenceImageUrls } from "@/lib/ai/knowledge-reference-urls";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z
  .object({
    category: aiKnowledgeCategoryZod.optional(),
    title: z.string().min(1).max(200).optional(),
    body: z.string().min(1).max(32000).optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(-2_147_483_648).max(2_147_483_647).optional(),
    reference_image_urls: zKnowledgeReferenceImageUrls.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Minstens één veld is verplicht." });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Ontbrekend id." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.data.category === KNOWLEDGE_JOURNAL_CATEGORY) {
    const { data: existing } = await supabase
      .from("ai_knowledge")
      .select("category")
      .eq("id", id)
      .maybeSingle();
    if (!existing || existing.category !== KNOWLEDGE_JOURNAL_CATEGORY) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Je kunt een regel niet naar ‘Claude activiteit’ verplaatsen; die categorie is alleen voor automatische logs.",
        },
        { status: 400 },
      );
    }
  }

  const { error } = await supabase.from("ai_knowledge").update(parsed.data).eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Ontbrekend id." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ai_knowledge").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KNOWLEDGE_JOURNAL_CATEGORY } from "@/lib/ai/knowledge-categories";
import type { AiKnowledgeRow } from "@/lib/data/ai-knowledge-shared";
import { MAX_REFERENCE_IMAGES_PER_ROW } from "@/lib/data/ai-knowledge-shared";

export type { AiKnowledgeRow } from "@/lib/data/ai-knowledge-shared";
export { MAX_REFERENCE_IMAGES_PER_ROW } from "@/lib/data/ai-knowledge-shared";

const MAX_REFERENCE_IMAGES_TOTAL = 14;

const SCREENSHOT_SYSTEM_NOTE = `BELANGRIJK — REFERENTIEBEELDEN: In het gebruikersbericht staan één of meer screenshots vóór de eigenlijke opdrachttekst. Die komen uit de studio-kennisbank (high-end/stijlvoorbeelden).
Gebruik ze om **kwaliteit** te halen: hiërarchie, witruimte, typografie, kleurstelling, sectie-opbouw, “premium”-sfeer.
Vertaal dat abstract naar de **briefing van deze klant** — geen letterlijke layout-kloon en geen overnemen van merklogo's of unieke huisstijl-elementen uit de plaatjes.`;

function isAllowedReferenceImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

type KnowledgeDbRow = {
  category: string;
  title: string;
  body: string;
  sort_order: number;
  reference_image_urls: string[] | null;
};

export type ClaudeKnowledgeContext = {
  systemText: string | undefined;
  userPrefixBlocks: ContentBlockParam[];
};

export async function getKnowledgeContextForClaude(): Promise<ClaudeKnowledgeContext> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("ai_knowledge")
      .select("category, title, body, sort_order, reference_image_urls")
      .eq("is_active", true)
      .neq("category", KNOWLEDGE_JOURNAL_CATEGORY)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error || !data?.length) {
      return { systemText: undefined, userPrefixBlocks: [] };
    }

    const rows = data as KnowledgeDbRow[];

    const lines: string[] = [
      "=== STUDIO KNOWLEDGE BASE (actieve instructies — volg deze bovenop je standaardtaak) ===",
      "",
    ];

    let lastCat = "";
    const tagged: { url: string; category: string; title: string }[] = [];

    for (const row of rows) {
      if (row.category !== lastCat) {
        if (lastCat) lines.push("");
        lines.push(`## Categorie: ${row.category}`);
        lastCat = row.category;
      }
      lines.push(`### ${row.title}`, row.body.trim(), "");

      const urls = normalizeUrlList(row.reference_image_urls)
        .filter(isAllowedReferenceImageUrl)
        .slice(0, MAX_REFERENCE_IMAGES_PER_ROW);

      for (const url of urls) {
        if (tagged.length >= MAX_REFERENCE_IMAGES_TOTAL) break;
        tagged.push({ url, category: row.category, title: row.title });
      }
      if (tagged.length >= MAX_REFERENCE_IMAGES_TOTAL) break;
    }

    let systemText = lines.join("\n").trim();
    if (tagged.length > 0) {
      systemText = `${systemText}\n\n${SCREENSHOT_SYSTEM_NOTE}`.trim();
    }

    if (tagged.length === 0) {
      return { systemText, userPrefixBlocks: [] };
    }

    const intro = `=== REFERENTIE-SCREENSHOTS (studio kennisbank) ===
De afbeeldingen hieronder horen bij onderstaande actieve regels. Bestudeer typografie, witruimte, kleurbeheersing, sectie-opbouw en algemene “high-end”-kwaliteit. Trek **patronen en principes** naar de huidige opdracht — geen 1-op-1 kopie van een specifieke merksite.

${tagged.map((t, i) => `${i + 1}. [${t.category}] ${t.title}`).join("\n")}`;

    const userPrefixBlocks: ContentBlockParam[] = [
      { type: "text", text: intro },
      ...tagged.map(
        (t): ContentBlockParam => ({
          type: "image",
          source: { type: "url", url: t.url },
        }),
      ),
    ];

    return { systemText, userPrefixBlocks };
  } catch {
    return { systemText: undefined, userPrefixBlocks: [] };
  }
}

export async function buildSystemContextFromKnowledge(): Promise<string | undefined> {
  const ctx = await getKnowledgeContextForClaude();
  return ctx.systemText;
}

export async function listAiKnowledgeForAdmin(): Promise<AiKnowledgeRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_knowledge")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data as AiKnowledgeRow[];
}

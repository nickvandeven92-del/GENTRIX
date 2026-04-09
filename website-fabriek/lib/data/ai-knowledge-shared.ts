/**
 * Alleen types + constanten — veilig te importeren vanuit Client Components.
 * Geen Supabase / next/headers.
 */

import type { AiKnowledgeCategory } from "@/lib/ai/knowledge-categories";

export type AiKnowledgeRow = {
  id: string;
  category: AiKnowledgeCategory | string;
  title: string;
  body: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  journal_source?: string | null;
  auto_generated?: boolean | null;
  reference_image_urls?: string[] | null;
};

/** Max. referentie-URL's per kennisregel (API + UI). */
export const MAX_REFERENCE_IMAGES_PER_ROW = 6;

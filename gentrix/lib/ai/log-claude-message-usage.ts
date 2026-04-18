import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ClaudeUsageOperation =
  | "generate_site"
  | "generate_site_design_rationale"
  | "generate_site_composition_plan"
  | "generate_site_self_review"
  | "edit_site"
  | "ai_site_command_snapshot"
  | "site_chat"
  | "activity_journal"
  | "extract_design_image"
  | "extract_site_intent"
  | "extract_prompt_interpretation"
  | "generate_brand_logo"
  | "briefing_reference_images_vision";

type MessageUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/**
 * Schrijft één usage-regel weg. Faalt stil als tabel ontbreekt of service role ontbreekt.
 */
export async function logClaudeMessageUsage(
  operation: ClaudeUsageOperation,
  model: string,
  usage: MessageUsage,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("ai_usage_events").insert({
      operation,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? null,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? null,
    });
    if (error && process.env.NODE_ENV === "development") {
      console.warn("[ai_usage_events]", error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[logClaudeMessageUsage]", e);
    }
  }
}

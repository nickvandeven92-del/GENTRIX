import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** JSON-serializable payload (server-only). */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export async function insertSiteGenerationChunkSession(payload: Json): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("site_generation_chunk_sessions")
    .insert({
      expires_at: expiresAt,
      payload,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("[site_generation_chunk_sessions insert]", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

export async function getSiteGenerationChunkSession(
  id: string,
): Promise<{ payload: Json; expires_at: string } | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("site_generation_chunk_sessions")
    .select("payload, expires_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { payload: Json; expires_at: string };
  return { payload: row.payload, expires_at: row.expires_at };
}

export async function updateSiteGenerationChunkSession(id: string, payload: Json): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("site_generation_chunk_sessions")
    .update({
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[site_generation_chunk_sessions update]", id, error.message);
    return false;
  }
  return true;
}

export async function deleteSiteGenerationChunkSession(id: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from("site_generation_chunk_sessions").delete().eq("id", id);
}

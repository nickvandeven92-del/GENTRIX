import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { isValidSubfolderSlug } from "@/lib/slug";

export async function resolveActivePortalClientIdBySlug(
  subfolderSlug: string,
): Promise<{ ok: true; clientId: string; name: string; appointmentsEnabled: boolean } | { ok: false; error: string }> {
  if (!isValidSubfolderSlug(subfolderSlug)) {
    return { ok: false, error: "Ongeldige slug." };
  }
  try {
    const supabase = createServiceRoleClient();
    const first = await supabase
      .from("clients")
      .select("id, name, appointments_enabled")
      .eq("subfolder_slug", subfolderSlug)
      .eq("status", "active")
      .maybeSingle();

    if (first.error && isPostgrestUnknownColumnError(first.error, "appointments_enabled")) {
      const second = await supabase
        .from("clients")
        .select("id, name")
        .eq("subfolder_slug", subfolderSlug)
        .eq("status", "active")
        .maybeSingle();
      if (second.error || !second.data) {
        return { ok: false, error: second.error?.message ?? "Klant niet gevonden." };
      }
      return {
        ok: true,
        clientId: second.data.id,
        name: second.data.name,
        appointmentsEnabled: false,
      };
    }

    if (first.error || !first.data) {
      return { ok: false, error: first.error?.message ?? "Klant niet gevonden." };
    }

    const row = first.data as { id: string; name: string; appointments_enabled?: boolean };
    return {
      ok: true,
      clientId: row.id,
      name: row.name,
      appointmentsEnabled: Boolean(row.appointments_enabled),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return { ok: false, error: "Serverconfiguratie ontbreekt." };
    }
    return { ok: false, error: msg };
  }
}

/** Publieke webshop-route `/winkel/{slug}` (los van boekingsmodule). */
export async function resolveActiveClientWebshopBySlug(
  subfolderSlug: string,
): Promise<{ ok: true; clientId: string; name: string; webshopEnabled: boolean } | { ok: false; error: string }> {
  if (!isValidSubfolderSlug(subfolderSlug)) {
    return { ok: false, error: "Ongeldige slug." };
  }
  try {
    const supabase = createServiceRoleClient();
    const first = await supabase
      .from("clients")
      .select("id, name, webshop_enabled")
      .eq("subfolder_slug", subfolderSlug)
      .eq("status", "active")
      .maybeSingle();

    if (first.error && isPostgrestUnknownColumnError(first.error, "webshop_enabled")) {
      const second = await supabase
        .from("clients")
        .select("id, name")
        .eq("subfolder_slug", subfolderSlug)
        .eq("status", "active")
        .maybeSingle();
      if (second.error || !second.data) {
        return { ok: false, error: second.error?.message ?? "Klant niet gevonden." };
      }
      return {
        ok: true,
        clientId: second.data.id,
        name: second.data.name,
        webshopEnabled: false,
      };
    }

    if (first.error || !first.data) {
      return { ok: false, error: first.error?.message ?? "Klant niet gevonden." };
    }

    const row = first.data as { id: string; name: string; webshop_enabled?: boolean };
    return {
      ok: true,
      clientId: row.id,
      name: row.name,
      webshopEnabled: Boolean(row.webshop_enabled),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return { ok: false, error: "Serverconfiguratie ontbreekt." };
    }
    return { ok: false, error: msg };
  }
}

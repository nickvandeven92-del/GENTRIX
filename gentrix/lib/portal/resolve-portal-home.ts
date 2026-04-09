import { listPortalClientsLinkedToUser, type PortalClientLink } from "@/lib/data/list-portal-clients-for-user";

export type PortalHomeResolution =
  | { kind: "single"; slug: string }
  | { kind: "none" }
  | { kind: "many"; clients: PortalClientLink[] };

/**
 * Bepaalt waar /home of /dashboard naartoe moet: één gekoppelde klant → direct portaal.
 */
export async function resolvePortalHome(): Promise<PortalHomeResolution> {
  const clients = await listPortalClientsLinkedToUser();
  if (clients.length === 1) {
    return { kind: "single", slug: clients[0].subfolder_slug };
  }
  if (clients.length === 0) {
    return { kind: "none" };
  }
  return { kind: "many", clients };
}

import { headers } from "next/headers";

/**
 * Basis-URL van de huidige request (bijv. https://jouw-domein.nl).
 * Gebruik voor absolute links naar `/site/...` zodat “Publieke site” in een echte browsertab
 * opent (handig in PWA / embedded webviews).
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const hostRaw = h.get("x-forwarded-host") ?? h.get("host");
  const host = hostRaw?.split(",")[0]?.trim();
  if (!host) return "";

  const protoRaw = h.get("x-forwarded-proto");
  const protoFirst = protoRaw?.split(",")[0]?.trim();
  const proto =
    protoFirst ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${proto}://${host}`;
}

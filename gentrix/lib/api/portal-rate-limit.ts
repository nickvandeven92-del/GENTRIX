/**
 * Eenvoudige per-user rate limit voor portal-API’s.
 * Deelt de backing-store met andere in-memory limieten — zie `rate-limit-memory.ts` voor beperkingen.
 */
import { checkMemoryRateLimit } from "@/lib/api/rate-limit-memory";

export function checkPortalRateLimit(userId: string, scope: string, maxPerWindow: number): boolean {
  return checkMemoryRateLimit(`portal:${scope}:${userId}`, maxPerWindow);
}

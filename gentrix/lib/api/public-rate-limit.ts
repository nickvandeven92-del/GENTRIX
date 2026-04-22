/**
 * Publieke endpoints: per IP + scope. Deelt de backing-store met `checkPortalRateLimit`.
 * Zie `rate-limit-memory.ts` voor beperkingen op serverless (multi-instance).
 */
import { checkMemoryRateLimit } from "@/lib/api/rate-limit-memory";

export function checkPublicRateLimit(ip: string, scope: string, maxPerWindow: number): boolean {
  return checkMemoryRateLimit(`public:${scope}:${ip}`, maxPerWindow);
}

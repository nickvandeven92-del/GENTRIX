import { fetchWithTimeout, FetchTimeoutError } from "@/lib/http/fetch-with-timeout";
import type {
  KvkMappedProfile,
  LeadWebsiteOutcome,
  LeadWebsiteReachability,
  WebsiteDetectionResult,
} from "@/lib/leads/kvk-enrichment-types";

const UA =
  "Gentrix-LeadEnrichment/1.0 (+https://example.invalid; contact: admin)";
const MAX_REDIRECTS = 5;
const PROBE_TIMEOUT_MS = 12_000;

export type LeadForWebsiteDetection = {
  profile: KvkMappedProfile;
  /** Handmatige override vanuit de UI */
  manualWebsiteUrl?: string | null;
};

function firstUrlFromKvk(websites: string[]): string | null {
  for (const raw of websites) {
    const n = normalizeWebsiteInput(raw);
    if (n) return n;
  }
  return null;
}

/** Maakt een bruikbare http(s)-URL; retourneert null bij onbruikbare input. */
export function normalizeWebsiteInput(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s.replace(/^\/\//, "")}`;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname || u.hostname.length < 3) return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Afgeleide URL: simpele slug uit bedrijfsnaam + .nl (alleen als geen KVK-URL).
 * Bewust conservatief — bij twijfel geen URL.
 */
function tryDeriveNlDomain(profile: KvkMappedProfile): string | null {
  const base =
    profile.hoofdvestiging?.eersteHandelsnaam?.trim() ||
    profile.statutaireNaam?.trim() ||
    profile.naam?.trim();
  if (!base) return null;
  const slug = base
    .toLowerCase()
    .replace(/\b(b\.?v\.?|n\.?v\.?|vof|ez|cv)\b\.?/gi, "")
    .replace(/&/g, " en ")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
  if (slug.length < 3) return null;
  try {
    return new URL(`https://www.${slug}.nl`).href;
  } catch {
    return null;
  }
}

type ProbeResult = {
  finalUrl: string;
  httpStatus: number;
  redirectCount: number;
  usedGet: boolean;
};

/**
 * HEAD eerst; bij 405/501 valt terug op GET (beperkte body wordt niet volledig gelezen).
 */
async function probeReachability(startUrl: string): Promise<ProbeResult | null> {
  let current = startUrl;
  let redirectCount = 0;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const tryOnce = async (method: "HEAD" | "GET"): Promise<Response | null> => {
      try {
        return await fetchWithTimeout(current, {
          method,
          redirect: "manual",
          timeoutMs: PROBE_TIMEOUT_MS,
          headers: {
            "User-Agent": UA,
            Accept: method === "GET" ? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" : "*/*",
          },
        });
      } catch (e) {
        if (e instanceof FetchTimeoutError) return null;
        return null;
      }
    };

    let res = await tryOnce("HEAD");
    let usedGet = false;
    if (res && (res.status === 405 || res.status === 501)) {
      res = await tryOnce("GET");
      usedGet = true;
    }
    if (!res) return null;

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || redirectCount >= MAX_REDIRECTS) {
        return { finalUrl: current, httpStatus: res.status, redirectCount, usedGet };
      }
      try {
        current = new URL(loc, current).href;
        redirectCount++;
        continue;
      } catch {
        return { finalUrl: current, httpStatus: res.status, redirectCount, usedGet };
      }
    }

    return { finalUrl: current, httpStatus: res.status, redirectCount, usedGet };
  }

  return null;
}

function toOutcome(
  hasUrl: boolean,
  probe: ProbeResult | null,
): { outcome: LeadWebsiteOutcome; reachability: LeadWebsiteReachability } {
  if (!hasUrl) return { outcome: "not_found", reachability: "unknown" };
  if (!probe) return { outcome: "uncertain", reachability: "unknown" };
  if (probe.httpStatus >= 200 && probe.httpStatus < 300) {
    if (probe.redirectCount > 0) return { outcome: "found_redirected", reachability: "redirect" };
    return { outcome: "found_live", reachability: "live" };
  }
  if (probe.httpStatus >= 300 && probe.httpStatus < 400) {
    return { outcome: "found_redirected", reachability: "redirect" };
  }
  if (probe.httpStatus >= 400) {
    return { outcome: "found_broken", reachability: "broken" };
  }
  return { outcome: "uncertain", reachability: "unknown" };
}

/**
 * 1) KVK-websites 2) handmatig 3) afgeleide .nl (alleen als nog niets)
 */
export async function detectWebsiteForLead(input: LeadForWebsiteDetection): Promise<WebsiteDetectionResult> {
  const manual = normalizeWebsiteInput(input.manualWebsiteUrl ?? undefined);
  if (manual) {
    const probe = await probeReachability(manual);
    const { outcome, reachability } = toOutcome(true, probe);
    const finalUrl = probe?.finalUrl ?? manual;
    let ssl: boolean | null = null;
    try {
      ssl = new URL(finalUrl).protocol === "https:";
    } catch {
      ssl = null;
    }
    return {
      detectedUrl: manual,
      detectionSource: "manual",
      reachability,
      outcome,
      httpStatus: probe?.httpStatus ?? null,
      finalUrl: probe ? new URL(finalUrl).href : manual,
      ssl,
    };
  }

  const fromKvk = firstUrlFromKvk(input.profile.websites);
  if (fromKvk) {
    const probe = await probeReachability(fromKvk);
    const { outcome, reachability } = toOutcome(true, probe);
    const finalUrl = probe?.finalUrl ?? fromKvk;
    let ssl: boolean | null = null;
    try {
      ssl = new URL(finalUrl).protocol === "https:";
    } catch {
      ssl = null;
    }
    return {
      detectedUrl: fromKvk,
      detectionSource: "kvk",
      reachability,
      outcome,
      httpStatus: probe?.httpStatus ?? null,
      finalUrl,
      ssl,
    };
  }

  const derived = tryDeriveNlDomain(input.profile);
  if (derived) {
    const probe = await probeReachability(derived);
    if (probe && probe.httpStatus >= 200 && probe.httpStatus < 400) {
      const { outcome, reachability } = toOutcome(true, probe);
      const finalUrl = probe.finalUrl;
      return {
        detectedUrl: derived,
        detectionSource: "derived",
        reachability,
        outcome,
        httpStatus: probe.httpStatus,
        finalUrl,
        ssl: new URL(finalUrl).protocol === "https:",
      };
    }
    return {
      detectedUrl: null,
      detectionSource: "derived",
      reachability: "unknown",
      outcome: "uncertain",
      httpStatus: probe?.httpStatus ?? null,
      finalUrl: probe?.finalUrl ?? null,
      ssl: probe ? (() => {
        try {
          return new URL(probe.finalUrl).protocol === "https:";
        } catch {
          return null;
        }
      })() : null,
    };
  }

  return {
    detectedUrl: null,
    detectionSource: "none",
    reachability: "unknown",
    outcome: "not_found",
    httpStatus: null,
    finalUrl: null,
    ssl: null,
  };
}

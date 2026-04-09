import { fetchWithTimeout, FetchTimeoutError } from "@/lib/http/fetch-with-timeout";
import type {
  WebsiteQualityAnalysis,
  WebsiteQualityFindings,
  WebsiteQualityVerdict,
} from "@/lib/leads/kvk-enrichment-types";

const UA =
  "Gentrix-LeadEnrichment/1.0 (+https://example.invalid; contact: admin)";
const FETCH_TIMEOUT_MS = 18_000;
const MAX_HTML_BYTES = 600_000;

const CTA_PATTERN =
  /\b(offerte|bestel|nu\s+kopen|gratis\s+consult|plan\s+gesprek|maak\s+afspraak|contact|op\s+maat|demo\s+aanvragen|vraag\s+aan|schrijf\s+je\s+in|subscribe|get\s+started|request\s+a\s+quote|book\s+a\s+call)\b/i;

const PARKED_PATTERN =
  /\b(domain\s+parked|this\s+domain\s+may\s+be\s+for\s+sale|godaddy|sedo\.com|hugedomains|squarespace.*parked|under\s+construction|coming\s+soon|default\s+web\s+page)\b/i;

const SOCIAL_PATTERN =
  /(facebook\.com\/|linkedin\.com\/|instagram\.com\/|x\.com\/|twitter\.com\/|youtube\.com\/|tiktok\.com\/)/i;

function verdictFrom(score: number, looksBroken: boolean): WebsiteQualityVerdict {
  if (looksBroken) return "broken";
  if (score >= 72) return "strong";
  if (score >= 45) return "average";
  return "weak";
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = m?.[1]?.replace(/\s+/g, " ")?.trim();
  return t && t.length > 0 ? t : null;
}

function hasMetaDescription(html: string): boolean {
  return /<meta[^>]+name\s*=\s*["']description["'][^>]*>/i.test(html);
}

function hasViewportMeta(html: string): boolean {
  return /<meta[^>]+name\s*=\s*["']viewport["'][^>]*>/i.test(html);
}

function hasTelOrMailto(html: string): boolean {
  return /href\s*=\s*["']mailto:/i.test(html) || /href\s*=\s*["']tel:/i.test(html);
}

function hasContactPaths(html: string): boolean {
  return /href\s*=\s*["'][^"']*(contact|over-ons|overons|klantenservice)[^"']*["']/i.test(html);
}

function hasSocial(html: string): boolean {
  return SOCIAL_PATTERN.test(html);
}

function looksParkedOrBroken(html: string, status: number): boolean {
  if (status >= 400) return true;
  const low = stripTags(html).toLowerCase();
  return PARKED_PATTERN.test(low) && html.length < 50_000;
}

/**
 * Lichte HTML-scan (geen DOM-parser dependency). Alleen aanroepen als URL live lijkt.
 */
export async function analyzeWebsite(url: string): Promise<WebsiteQualityAnalysis> {
  let html = "";
  let status = 0;
  let usesHttps = false;
  try {
    usesHttps = new URL(url).protocol === "https:";
  } catch {
    usesHttps = false;
  }

  try {
    const res = await fetchWithTimeout(url, {
      method: "GET",
      redirect: "follow",
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    status = res.status;
    const reader = res.body?.getReader();
    if (!reader) {
      return brokenResult("Geen response-body", usesHttps);
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        chunks.push(value);
        if (total >= MAX_HTML_BYTES) break;
      }
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    html = buf.toString("utf8", 0, Math.min(buf.length, MAX_HTML_BYTES));
  } catch (e) {
    if (e instanceof FetchTimeoutError) {
      return brokenResult("Timeout bij ophalen pagina", usesHttps);
    }
    return brokenResult("Pagina niet ophalen", usesHttps);
  }

  const title = extractTitle(html);
  const metaDesc = hasMetaDescription(html);
  const viewport = hasViewportMeta(html);
  const cta = CTA_PATTERN.test(stripTags(html));
  const contact = hasTelOrMailto(html) || hasContactPaths(html);
  const social = hasSocial(html);
  const parked = looksParkedOrBroken(html, status);

  const findings: WebsiteQualityFindings = {
    hasTitle: Boolean(title && title.length > 2),
    hasMetaDescription: metaDesc,
    hasViewport: viewport,
    hasCTA: cta,
    hasContactSignals: contact,
    hasSocialLinks: social,
    usesHttps,
    looksParkedOrBroken: parked,
  };

  let score = 0;
  const labels: string[] = [];
  if (findings.hasTitle) {
    score += 12;
    labels.push("title");
  }
  if (findings.hasMetaDescription) {
    score += 12;
    labels.push("meta-description");
  }
  if (findings.hasViewport) {
    score += 14;
    labels.push("viewport");
  }
  if (findings.usesHttps) {
    score += 18;
    labels.push("https");
  }
  if (findings.hasContactSignals) {
    score += 14;
    labels.push("contact");
  }
  if (findings.hasCTA) {
    score += 10;
    labels.push("cta");
  }
  if (findings.hasSocialLinks) {
    score += 8;
    labels.push("social");
  }
  if (parked) {
    score = Math.min(score, 25);
    labels.push("parked-signal");
  }
  if (status >= 400) {
    score = Math.min(score, 15);
    labels.push(`http-${status}`);
  }

  score = Math.max(0, Math.min(100, score));
  const verdict = verdictFrom(score, parked || status >= 400);

  return { score, labels, findings, verdict };
}

function brokenResult(reason: string, usesHttps: boolean): WebsiteQualityAnalysis {
  return {
    score: 0,
    labels: ["broken", reason],
    findings: {
      hasTitle: false,
      hasMetaDescription: false,
      hasViewport: false,
      hasCTA: false,
      hasContactSignals: false,
      hasSocialLinks: false,
      usesHttps,
      looksParkedOrBroken: true,
    },
    verdict: "broken",
  };
}

/**
 * Heuristische detectie van waarschijnlijk **verzonnen** marketing-/claimtaal in gegenereerde HTML/tekst.
 * Geen juridische waarheid — bedoeld voor QA-waarschuwingen, admin-paneel en CI.
 *
 * Severity (policy):
 * - **error (hard):** promotion, urgency, award, market leadership (fake authority)
 * - **warn:** pricing-ish, support promises, shipping, social proof, guarantees
 */

import { CONTENT_AUTHORITY_POLICY_VERSION } from "@/lib/ai/content-authority-policy";

export type ClaimDiagnosticCode =
  | "invented_promotion"
  | "invented_discount"
  | "invented_urgency"
  | "invented_award"
  | "invented_market_leadership"
  | "invented_social_proof"
  | "invented_pricing"
  | "invented_support_promise"
  | "invented_shipping"
  | "invented_guarantee";

export type ClaimDiagnosticSeverity = "warn" | "error";

export type ClaimDiagnostic = {
  code: ClaimDiagnosticCode;
  severity: ClaimDiagnosticSeverity;
  /** Gevonden fragment (genormaliseerd, max. lengte). */
  match: string;
  /** Eerste index in input (UTF-16). */
  index: number;
};

/** Rijke payload voor admin UI / logging (niet in site_data_json opslaan). */
export type ContentClaimDiagnosticsReport = {
  policyVersion: typeof CONTENT_AUTHORITY_POLICY_VERSION;
  errorCount: number;
  warnCount: number;
  items: Array<{
    code: ClaimDiagnosticCode;
    severity: ClaimDiagnosticSeverity;
    match: string;
    index: number;
    /** Korte context rond de treffer (platte tekst). */
    fragment: string;
  }>;
};

type Pattern = {
  code: ClaimDiagnosticCode;
  severity: ClaimDiagnosticSeverity;
  re: RegExp;
};

const PATTERNS: Pattern[] = [
  { code: "invented_promotion", severity: "error", re: /\bblack\s*friday\b/gi },
  { code: "invented_promotion", severity: "error", re: /\bcyber\s*monday\b/gi },
  { code: "invented_discount", severity: "error", re: /\b\d{1,2}\s*%\s*korting\b/gi },
  { code: "invented_discount", severity: "error", re: /\bkorting\s*van\s*\d{1,3}\s*%/gi },
  { code: "invented_urgency", severity: "error", re: /\blimited\s*time\b/gi },
  { code: "invented_urgency", severity: "error", re: /\bnu\s*\d{1,2}\s*%\s*extra\b/gi },
  { code: "invented_award", severity: "error", re: /\baward[\s-]*winning\b/gi },
  { code: "invented_market_leadership", severity: "error", re: /\bmarket\s*leader\b/gi },
  { code: "invented_market_leadership", severity: "error", re: /\bmarktleider\b/gi },
  { code: "invented_market_leadership", severity: "error", re: /\b#1\s+(in|van|for)\b/gi },
  {
    code: "invented_social_proof",
    severity: "warn",
    re: /\btrusted\s+by\s*[\d,]+\+?/gi,
  },
  {
    code: "invented_social_proof",
    severity: "warn",
    re: /\b(meer\s+dan|over)\s*\d{2,}\s*\+?\s*(klanten|bedrijven|klant)\b/gi,
  },
  { code: "invented_social_proof", severity: "warn", re: /\b5\s*stars?\b/gi },
  { code: "invented_social_proof", severity: "warn", re: /⭐{3,}/g },
  {
    code: "invented_pricing",
    severity: "warn",
    re: /\bstarting\s+at\s*€\s*[\d.,]+/gi,
  },
  { code: "invented_pricing", severity: "warn", re: /\bvanaf\s*€\s*[\d.,]+/gi },
  { code: "invented_pricing", severity: "warn", re: /€\s*[\d.,]+\s*\/\s*(maand|jr|jaar)\b/gi },
  {
    code: "invented_support_promise",
    severity: "warn",
    re: /\b24\s*\/\s*7\s*(support|service|bereikbaar)/gi,
  },
  {
    code: "invented_social_proof",
    severity: "warn",
    re: /\b\d{2,3}\s*\+\s*jaar\s*(ervaring|in het vak|in de branche|in metaal)\b/gi,
  },
  {
    code: "invented_social_proof",
    severity: "warn",
    re: /\b\d{2,3}\s*\+\s*jaar\b/gi,
  },
  {
    code: "invented_social_proof",
    severity: "warn",
    re: /\b\d{3,4}\s*\+\s*projecten?\b/gi,
  },
  {
    code: "invented_social_proof",
    severity: "warn",
    re: /\bonline\s+sinds\s*\d{4}\b/gi,
  },
  { code: "invented_shipping", severity: "warn", re: /\bfree\s+shipping\b/gi },
  { code: "invented_shipping", severity: "warn", re: /\bgratis\s*verzending\b/gi },
  { code: "invented_guarantee", severity: "warn", re: /\bmoney[\s-]*back\s*guarantee\b/gi },
  { code: "invented_guarantee", severity: "warn", re: /\bniet\s+goed\s*,\s*geld\s+terug\b/gi },
];

function clip(s: string, max = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** Context rond `index` voor admin (HTML-tags worden plat meegenomen). */
export function extractClaimContextFragment(source: string, index: number, radius = 72): string {
  if (index < 0 || index > source.length) return "";
  const start = Math.max(0, index - radius);
  const end = Math.min(source.length, index + radius);
  const raw = source.slice(start, end).replace(/\s+/g, " ").trim();
  return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
}

type RawHit = ClaimDiagnostic & { end: number };

/**
 * Zoekt patronen die vaak wijzen op **verzonnen** marketing (heuristiek).
 * Dedupliceert overlappende treffers (één melding per positie-cluster).
 */
export function diagnoseInventedMarketingClaims(source: string): ClaimDiagnostic[] {
  const raw: RawHit[] = [];
  for (const { code, severity, re } of PATTERNS) {
    let m: RegExpExecArray | null;
    const localRe = new RegExp(re.source, re.flags);
    while ((m = localRe.exec(source)) !== null) {
      const full = m[0] ?? "";
      raw.push({
        code,
        severity,
        match: clip(full),
        index: m.index,
        end: m.index + full.length,
      });
      if (m.index === localRe.lastIndex) localRe.lastIndex++;
    }
  }
  raw.sort((a, b) => a.index - b.index);
  const out: ClaimDiagnostic[] = [];
  let acceptedUntil = -1;
  for (const d of raw) {
    if (d.index < acceptedUntil) continue;
    out.push({ code: d.code, severity: d.severity, match: d.match, index: d.index });
    acceptedUntil = d.end;
  }
  return out;
}

export function buildContentClaimDiagnosticsReport(html: string): ContentClaimDiagnosticsReport {
  const raw = diagnoseInventedMarketingClaims(html);
  const items = raw.map((d) => ({
    code: d.code,
    severity: d.severity,
    match: d.match,
    index: d.index,
    fragment: extractClaimContextFragment(html, d.index),
  }));
  const errorCount = items.filter((i) => i.severity === "error").length;
  const warnCount = items.filter((i) => i.severity === "warn").length;
  return {
    policyVersion: CONTENT_AUTHORITY_POLICY_VERSION,
    errorCount,
    warnCount,
    items,
  };
}

export function hasErrorSeverityClaim(diagnostics: ClaimDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

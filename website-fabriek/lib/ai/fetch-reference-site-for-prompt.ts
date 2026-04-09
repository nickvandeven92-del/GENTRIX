/**
 * Haalt een publieke HTML-pagina op en maakt een compacte tekst-snapshot voor de site-generatorprompt.
 * Let op SSRF: alleen http(s), geen loopback/private hosts.
 */

const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 1_400_000;
const EXCERPT_MAX_CHARS = 12_000;

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "metadata.google.internal" || h === "metadata") return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = h.match(ipv4);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (![a, b, Number(m[3]), Number(m[4])].every((n) => n >= 0 && n <= 255)) return true;
    if (a === 0 || a === 127) return true;
    if (a === 10) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 255 && b === 255) return true;
  }

  if (h === "[::1]" || h === "::1") return true;
  return false;
}

function stripHtmlToText(html: string): string {
  let s = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/gi, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number.parseInt(n, 10);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : " ";
  });
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, hx) => {
    const code = Number.parseInt(hx, 16);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : " ";
  });
  return s.replace(/\s+/g, " ").trim();
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return stripHtmlToText(m[1]!).slice(0, 200) || null;
}

function extractMetaDescription(html: string): string | null {
  const m = html.match(
    /<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
  );
  if (m?.[1]) return stripHtmlToText(m[1]).slice(0, 400) || null;
  const m2 = html.match(
    /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i,
  );
  if (m2?.[1]) return stripHtmlToText(m2[1]).slice(0, 400) || null;
  return null;
}

function extractHexSamples(html: string, limit: number): string[] {
  const found = new Set<string>();
  const re = /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi;
  let x: RegExpExecArray | null;
  while ((x = re.exec(html)) !== null && found.size < limit) {
    found.add(x[0]!.toLowerCase());
  }
  return [...found];
}

async function fetchWithRedirectLimit(
  url: string,
  redirectLeft: number,
): Promise<{ ok: true; html: string; finalUrl: string } | { ok: false; error: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "WebsiteFabriek-ReferenceFetcher/1.0",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || redirectLeft <= 0) {
        return { ok: false, error: "Te veel redirects of ontbrekende Location-header." };
      }
      let next: string;
      try {
        next = new URL(loc, url).toString();
      } catch {
        return { ok: false, error: "Ongeldige redirect-URL." };
      }
      const u = new URL(next);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, error: "Redirect naar niet-toegestaan protocol." };
      }
      if (isBlockedHostname(u.hostname)) {
        return { ok: false, error: "Redirect naar niet-toegestaan host." };
      }
      return fetchWithRedirectLimit(next, redirectLeft - 1);
    }

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return { ok: false, error: "Pagina is te groot om veilig te verwerken." };
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return { ok: true, html, finalUrl: url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende netwerkfout";
    if (msg.includes("abort")) return { ok: false, error: "Timeout bij ophalen referentiesite." };
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export type FetchReferenceSiteResult =
  | { ok: true; excerpt: string; finalUrl: string }
  | { ok: false; error: string };

/**
 * Valideert URL, haalt HTML op, bouwt een prompt-vriendelijke excerpt (titel, meta, tekst, kleurhints).
 */
export async function fetchReferenceSiteForPrompt(rawUrl: string): Promise<FetchReferenceSiteResult> {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "Ongeldige URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "Alleen http(s)-URL's zijn toegestaan." };
  }
  if (isBlockedHostname(u.hostname)) {
    return { ok: false, error: "Deze host is niet toegestaan (veiligheid)." };
  }

  const fetched = await fetchWithRedirectLimit(u.toString(), MAX_REDIRECTS);
  if (!fetched.ok) return fetched;

  const html = fetched.html;
  if (html.length < 80) {
    return { ok: false, error: "Lege of te korte response." };
  }

  const title = extractTitle(html);
  const desc = extractMetaDescription(html);
  const text = stripHtmlToText(html).slice(0, EXCERPT_MAX_CHARS);
  const colors = extractHexSamples(html, 24);

  const parts: string[] = [];
  parts.push(`Final URL: ${fetched.finalUrl}`);
  if (title) parts.push(`Title: ${title}`);
  if (desc) parts.push(`Meta description: ${desc}`);
  if (colors.length > 0) parts.push(`Kleur-fragmenten uit markup (hints, geen garantie): ${colors.join(", ")}`);
  parts.push("");
  parts.push("Paginatekst (ingekort, tags verwijderd):");
  parts.push(text.length > 0 ? text : "(geen tekst geëxtraheerd)");

  const excerpt = parts.join("\n").slice(0, EXCERPT_MAX_CHARS + 800);
  if (excerpt.trim().length < 40) {
    return { ok: false, error: "Kon onvoldoende inhoud uit de pagina halen." };
  }

  return { ok: true, excerpt, finalUrl: fetched.finalUrl };
}

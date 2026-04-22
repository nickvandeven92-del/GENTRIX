/**
 * Splitst de door `buildTailwindIframeSrcDoc` geproduceerde HTML in de delen die nodig zijn
 * om de pagina **zonder iframe** direct in de Next.js-pagina te renderen:
 *
 * – `headHtml`: alles wat in `<head>` moet (meta, style, external scripts)
 * – `bodyClassName` / `bodyDataAttrs`: attributen op `<body>`, toegepast op de wrapper-div
 * – `bodyHtml`: body-inner-HTML inclusief scripts — scripts runnen bij elke SSR page-load
 *
 * Regex-parser: de input is altijd door onze eigen builder gegenereerd, dus structuur is
 * deterministisch. Geen jsdom nodig → sneller + geen dep-risico.
 */

export type TailwindPageParts = {
  headHtml: string;
  bodyClassName: string;
  bodyDataAttrs: Record<string, string>;
  bodyHtml: string;
};

const HEAD_BLOCK_RE = /<head\b[^>]*>([\s\S]*?)<\/head>/i;
const BODY_OPEN_RE = /<body\b([^>]*)>/i;
const BODY_CLOSE_RE = /<\/body>/i;
const ATTR_RE = /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseAttributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const padded = ` ${raw.trim()}`;
  let match: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((match = ATTR_RE.exec(padded)) != null) {
    const name = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    out[name] = value;
  }
  return out;
}

/**
 * Parse de door `buildTailwindIframeSrcDoc` geproduceerde HTML naar losse stukken voor inline render.
 */
export function extractTailwindPageParts(fullHtml: string): TailwindPageParts {
  const headMatch = HEAD_BLOCK_RE.exec(fullHtml);
  const bodyOpenMatch = BODY_OPEN_RE.exec(fullHtml);
  const bodyCloseMatch = BODY_CLOSE_RE.exec(fullHtml);

  const headHtml = headMatch?.[1] ?? "";
  const bodyAttrRaw = bodyOpenMatch?.[1] ?? "";
  const bodyStart = bodyOpenMatch ? bodyOpenMatch.index + bodyOpenMatch[0].length : 0;
  const bodyEnd = bodyCloseMatch ? bodyCloseMatch.index : fullHtml.length;
  const bodyHtml = fullHtml.slice(bodyStart, bodyEnd);

  const bodyAttrs = parseAttributes(bodyAttrRaw);
  const bodyClassName = bodyAttrs.class ?? "";
  delete bodyAttrs.class;
  delete bodyAttrs.style;
  const bodyDataAttrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(bodyAttrs)) {
    if (k.startsWith("data-") || k === "id") bodyDataAttrs[k] = v;
  }

  return {
    headHtml,
    bodyClassName,
    bodyDataAttrs,
    bodyHtml,
  };
}

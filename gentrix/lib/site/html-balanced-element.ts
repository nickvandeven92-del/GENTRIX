import { findHtmlOpenTagEnd } from "@/lib/site/html-open-tag";

function findNextSameLocalOpenOrClose(
  html: string,
  pos: number,
  local: string,
): { kind: "open" | "close"; index: number } | null {
  const openRe = new RegExp(`<${local}\\b`, "gi");
  const closeRe = new RegExp(`</${local}\\b`, "gi");
  openRe.lastIndex = pos;
  closeRe.lastIndex = pos;
  const om = openRe.exec(html);
  const cm = closeRe.exec(html);
  if (!om && !cm) return null;
  const oi = om?.index ?? Number.POSITIVE_INFINITY;
  const ci = cm?.index ?? Number.POSITIVE_INFINITY;
  if (oi < ci) return { kind: "open", index: om!.index };
  return { kind: "close", index: cm!.index };
}

/**
 * Eerste gebalanceerde `<local>…</local>` vanaf `openIndex` (quote-aware open-tags).
 * Gebruikt door site-chrome slicing en door compose-stappen die geen naïeve `[^>]*` mogen gebruiken.
 */
export function walkBalancedSameLocalBlock(
  html: string,
  openIndex: number,
  local: "header" | "nav" | "div",
): { block: string; start: number; end: number } | null {
  const openEnd = findHtmlOpenTagEnd(html, openIndex);
  if (openEnd <= openIndex) return null;
  const opener = html.slice(openIndex, openEnd);
  if (!new RegExp(`^<${local}\\b`, "i").test(opener)) return null;
  let depth = 1;
  let pos = openEnd;
  while (depth > 0) {
    const next = findNextSameLocalOpenOrClose(html, pos, local);
    if (!next) return null;
    const tagEnd = findHtmlOpenTagEnd(html, next.index);
    if (next.kind === "close") {
      depth -= 1;
      if (depth === 0) {
        return { block: html.slice(openIndex, tagEnd), start: openIndex, end: tagEnd };
      }
      pos = tagEnd;
    } else {
      depth += 1;
      pos = tagEnd;
    }
  }
  return null;
}

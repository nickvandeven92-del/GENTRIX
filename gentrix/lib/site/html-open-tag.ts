/**
 * Quote-aware scans for HTML open-tags. Naive `[^>]*` breaks on `>` inside quoted
 * attribute values (common in Tailwind arbitrary classes), leaking fragments like `10">` as text.
 */

/**
 * Index immediately after the closing `>` of the tag whose `<` is at `tagStart`.
 */
export function findHtmlOpenTagEnd(html: string, tagStart: number): number {
  if (tagStart < 0 || tagStart >= html.length || html[tagStart] !== "<") {
    return Math.min(Math.max(tagStart, 0) + 1, html.length);
  }
  let i = tagStart + 1;
  let inQuote: '"' | "'" | null = null;
  while (i < html.length) {
    const c = html[i]!;
    if (inQuote) {
      if (c === inQuote) inQuote = null;
    } else {
      if (c === '"' || c === "'") inQuote = c;
      else if (c === ">") return i + 1;
    }
    i++;
  }
  return html.length;
}

/**
 * Quote-aware slice of one open tag starting at `tagStart` (`<` … `>` inclusive).
 * `attrs` is the substring between the tag name and the closing `>` (often starts with whitespace).
 */
export function sliceOpenTagContent(
  html: string,
  tagStart: number,
): { tagName: string; attrs: string; full: string; end: number } | null {
  const end = findHtmlOpenTagEnd(html, tagStart);
  if (end <= tagStart || html[tagStart] !== "<") return null;
  const full = html.slice(tagStart, end);
  const m = /^<([a-zA-Z][\w:-]*)\b/i.exec(full);
  if (!m) return null;
  const tagName = m[1]!;
  const attrs = full.slice(m[0].length, full.length - 1);
  return { tagName, attrs, full, end };
}

/**
 * Replace each open tag with local name `localName` (e.g. `img`, `source`) using `fn`.
 * Only the opening tag is matched; paired elements are not closed here.
 */
export function replaceAllOpenTagsByLocalName(
  html: string,
  localName: string,
  fn: (fullTag: string) => string,
): string {
  if (!/^[a-z][a-z0-9-]*$/i.test(localName)) {
    throw new Error(`replaceAllOpenTagsByLocalName: invalid localName ${JSON.stringify(localName)}`);
  }
  const re = new RegExp(`<${localName}\\b`, "gi");
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out += html.slice(last, m.index);
    const end = findHtmlOpenTagEnd(html, m.index);
    const full = html.slice(m.index, end);
    out += fn(full);
    last = end;
    re.lastIndex = end;
  }
  out += html.slice(last);
  return out;
}

/**
 * Ruwe zichtbare tekst uit HTML-fragmenten (secties) voor externe spellingscontrole.
 * Geen DOM-parser nodig; voldoende voor LanguageTool op marketingcopy.
 */
export function extractPlainTextFromHtml(html: string): string {
  const withoutBlocks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const withoutTags = withoutBlocks.replace(/<[^>]+>/g, " ");
  return withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

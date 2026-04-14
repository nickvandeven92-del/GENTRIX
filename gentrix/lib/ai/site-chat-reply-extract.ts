/**
 * Haalt tijdens streaming het `reply`-veld uit het site-chat JSON-antwoord,
 * zodat de UI al tekst kan tonen voordat het volledige object binnen is.
 */
export function extractPartialReplyFromStreamingSiteChatJson(buffer: string): string {
  const needle = '"reply"';
  const i = buffer.indexOf(needle);
  if (i === -1) return "";
  let pos = i + needle.length;
  while (pos < buffer.length && /\s/.test(buffer[pos]!)) pos++;
  if (pos >= buffer.length || buffer[pos] !== ":") return "";
  pos++;
  while (pos < buffer.length && /\s/.test(buffer[pos]!)) pos++;
  if (pos >= buffer.length || buffer[pos] !== '"') return "";
  pos++;

  let out = "";
  while (pos < buffer.length) {
    const c = buffer[pos]!;
    if (c === '"') break;
    if (c === "\\") {
      pos++;
      if (pos >= buffer.length) break;
      const e = buffer[pos]!;
      switch (e) {
        case "n":
          out += "\n";
          pos++;
          break;
        case "r":
          out += "\r";
          pos++;
          break;
        case "t":
          out += "\t";
          pos++;
          break;
        case '"':
          out += '"';
          pos++;
          break;
        case "\\":
          out += "\\";
          pos++;
          break;
        case "/":
          out += "/";
          pos++;
          break;
        case "b":
          out += "\b";
          pos++;
          break;
        case "f":
          out += "\f";
          pos++;
          break;
        case "u": {
          const hexStart = pos + 1;
          if (hexStart + 4 > buffer.length) return out;
          const hex = buffer.slice(hexStart, hexStart + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return out;
          out += String.fromCodePoint(parseInt(hex, 16));
          pos = hexStart + 4;
          break;
        }
        default:
          out += e;
          pos++;
          break;
      }
      continue;
    }
    out += c;
    pos++;
  }
  return out;
}

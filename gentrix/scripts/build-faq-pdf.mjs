/**
 * Bouwt public/docs/veelgestelde-vragen-gentrix.pdf uit lib/admin/user-faq-nl.json.
 * Run: node scripts/build-faq-pdf.mjs  (na npm install)
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const jsonPath = join(root, "lib", "admin", "user-faq-nl.json");
const outDir = join(root, "public", "docs");
const outPath = join(outDir, "veelgestelde-vragen-gentrix.pdf");

const items = JSON.parse(readFileSync(jsonPath, "utf8"));

function wrapLine(text, font, size, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxW) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function wrapParagraph(text, font, size, maxW) {
  const paras = String(text).split(/\n/);
  const out = [];
  for (const p of paras) {
    const words = p.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) <= maxW) cur = trial;
      else {
        if (cur) out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
    out.push("");
  }
  return out.filter((l, i, a) => !(l === "" && a[i + 1] === ""));
}

async function main() {
  const pdf = await PDFDocument.create();
  const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595;
  const pageH = 842;
  const margin = 56;
  const maxW = pageW - margin * 2;
  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const title = "Veelgestelde vragen";
  const subtitle = "GENTRIX — in gewone taal";
  page.drawText(title, {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.12, 0.12, 0.14),
  });
  y -= 28;
  page.drawText(subtitle, {
    x: margin,
    y,
    size: 11,
    font: fontReg,
    color: rgb(0.35, 0.35, 0.4),
  });
  y -= 36;

  const qSize = 11;
  const aSize = 10.5;
  const qGap = 6;
  const aLine = 13;
  const blockGap = 18;

  for (const item of items) {
    const qLines = wrapLine(item.question, fontBold, qSize, maxW);
    const aLines = wrapParagraph(item.answer, fontReg, aSize, maxW);

    const blockH =
      qLines.length * (qSize + 4) +
      qGap +
      aLines.filter((l) => l !== "").length * aLine +
      blockGap;

    if (y < margin + blockH) {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - margin;
    }

    for (const line of qLines) {
      page.drawText(line, {
        x: margin,
        y: y - qSize,
        size: qSize,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.12),
      });
      y -= qSize + 4;
    }
    y -= qGap;

    for (const line of aLines) {
      if (line === "") {
        y -= aLine * 0.35;
        continue;
      }
      if (y < margin + aLine) {
        page = pdf.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(line, {
        x: margin,
        y: y - aSize,
        size: aSize,
        font: fontReg,
        color: rgb(0.22, 0.22, 0.26),
      });
      y -= aLine;
    }
    y -= blockGap;
  }

  const bytes = await pdf.save();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, bytes);
  console.log("Wrote", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

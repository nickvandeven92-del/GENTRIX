import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { PUBLIC_BRAND } from "@/lib/constants";

export type FlyerPdfTemplateId = "minimal" | "modern";

const A4_W = 595;
const A4_H = 842;
const M = 52;
const QR_PT = 200;

function wrapLines(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxW) cur = trial;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  yStart: number,
  maxW: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  lineGap: number,
): number {
  let y = yStart;
  for (const line of wrapLines(text, font, size, maxW)) {
    page.drawText(line, { x, y, size, font, color });
    y -= size + lineGap;
  }
  return y;
}

/**
 * A4-flyer met vaste copy + QR (concept/preview-link). Geen vrije layout — alleen template + klantnaam.
 */
export async function buildClientFlyerPdf(input: {
  template: FlyerPdfTemplateId;
  clientDisplayName: string;
  flyerPageUrl: string;
}): Promise<Uint8Array> {
  const { template, clientDisplayName, flyerPageUrl } = input;
  const name = clientDisplayName.trim() || "Jouw bedrijf";

  const qrPng = await QRCode.toBuffer(flyerPageUrl, {
    type: "png",
    width: 900,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4_W, A4_H]);
  const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(qrPng);
  const qrDims = qrImage.scale(QR_PT / qrImage.width);

  const maxW = A4_W - M * 2;
  const isModern = template === "modern";

  if (isModern) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: A4_W,
      height: A4_H,
      color: rgb(0.06, 0.08, 0.12),
    });
    const fg = rgb(0.96, 0.97, 0.98);
    const sub = rgb(0.72, 0.76, 0.82);

    let y = A4_H - M;
    page.drawText("Scan — bekijk je conceptwebsite", {
      x: M,
      y,
      size: 17,
      font: fontBold,
      color: fg,
    });
    y -= 36;
    page.drawText(name, { x: M, y, size: 26, font: fontBold, color: fg });
    y -= 40;
    y = drawWrapped(
      page,
      "Richt je camera op de QR-code. Je ziet meteen een voorbeeld in de browser — geen app nodig. Daarna kun je een gesprek plannen of een offerte vragen.",
      M,
      y,
      maxW,
      11,
      fontReg,
      sub,
      3,
    );
    y -= 16;

    const qrX = (A4_W - QR_PT) / 2;
    const qrY = 240;
    page.drawRectangle({
      x: qrX - 12,
      y: qrY - 12,
      width: QR_PT + 24,
      height: QR_PT + 24,
      color: rgb(1, 1, 1),
    });
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrDims.width, height: qrDims.height });
    let uy = qrY - 28;
    for (const line of wrapLines(flyerPageUrl, fontReg, 8, maxW)) {
      page.drawText(line, { x: M, y: uy, size: 8, font: fontReg, color: sub });
      uy -= 10;
    }
    page.drawText(PUBLIC_BRAND, {
      x: M,
      y: M - 8,
      size: 9,
      font: fontBold,
      color: rgb(0.55, 0.6, 0.68),
    });
  } else {
    const ink = rgb(0.14, 0.15, 0.18);
    const muted = rgb(0.38, 0.4, 0.45);

    let y = A4_H - M;
    page.drawText("Scan — bekijk je conceptwebsite", {
      x: M,
      y,
      size: 17,
      font: fontBold,
      color: ink,
    });
    y -= 36;
    page.drawText(name, { x: M, y, size: 26, font: fontBold, color: ink });
    y -= 40;
    y = drawWrapped(
      page,
      "Richt je camera op de QR-code. Je ziet meteen een voorbeeld in de browser — geen app nodig. Daarna kun je een gesprek plannen of een offerte vragen.",
      M,
      y,
      maxW,
      11,
      fontReg,
      muted,
      3,
    );
    y -= 20;

    const qrX = (A4_W - QR_PT) / 2;
    const qrY = 240;
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrDims.width, height: qrDims.height });
    let uy = qrY - 22;
    for (const line of wrapLines(flyerPageUrl, fontReg, 8, maxW)) {
      page.drawText(line, { x: M, y: uy, size: 8, font: fontReg, color: muted });
      uy -= 10;
    }
    page.drawText(PUBLIC_BRAND, {
      x: M,
      y: M - 8,
      size: 9,
      font: fontBold,
      color: rgb(0.55, 0.55, 0.58),
    });
  }

  return pdf.save();
}

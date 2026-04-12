import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { PUBLIC_BRAND } from "@/lib/constants";

export type FlyerPdfTemplateId = "minimal" | "modern";

const A4_W = 595;
const A4_H = 842;
const M = 52;
const QR_PT = 208;
const ACCENT = rgb(0.42, 0.32, 0.82);

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
    width: 920,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#18181bff", light: "#ffffffff" },
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
      color: rgb(0.05, 0.06, 0.1),
    });
    page.drawRectangle({ x: 0, y: A4_H - 5, width: A4_W, height: 5, color: ACCENT });
    page.drawRectangle({
      x: M - 8,
      y: M - 8,
      width: A4_W - (M - 8) * 2,
      height: A4_H - (M - 8) * 2,
      borderColor: rgb(0.22, 0.24, 0.32),
      borderWidth: 0.75,
    });
    const fg = rgb(0.96, 0.97, 0.98);
    const sub = rgb(0.72, 0.76, 0.82);

    let y = A4_H - M - 6;
    page.drawText("CONCEPTWEBSITE", {
      x: M,
      y,
      size: 9,
      font: fontBold,
      color: ACCENT,
    });
    y -= 22;
    page.drawText("Scan en bekijk direct online", {
      x: M,
      y,
      size: 18,
      font: fontBold,
      color: fg,
    });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: A4_W - M, y }, thickness: 1, color: rgb(0.28, 0.3, 0.38) });
    y -= 28;
    page.drawText(name, { x: M, y, size: 28, font: fontBold, color: fg });
    y -= 44;
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
    y -= 20;

    const qrX = (A4_W - QR_PT) / 2;
    const qrY = 228;
    const pad = 16;
    page.drawRectangle({
      x: qrX - pad,
      y: qrY - pad,
      width: QR_PT + pad * 2,
      height: QR_PT + pad * 2,
      color: rgb(1, 1, 1),
    });
    page.drawRectangle({
      x: qrX - pad,
      y: qrY - pad,
      width: QR_PT + pad * 2,
      height: QR_PT + pad * 2,
      borderColor: rgb(0.88, 0.89, 0.92),
      borderWidth: 0.5,
    });
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrDims.width, height: qrDims.height });
    let uy = qrY - 30;
    page.drawText("Controlelink", { x: M, y: uy, size: 8, font: fontBold, color: rgb(0.55, 0.58, 0.65) });
    uy -= 12;
    for (const line of wrapLines(flyerPageUrl, fontReg, 7.5, maxW)) {
      page.drawText(line, { x: M, y: uy, size: 7.5, font: fontReg, color: sub });
      uy -= 9.5;
    }
    page.drawText(PUBLIC_BRAND, {
      x: M,
      y: M - 6,
      size: 9,
      font: fontBold,
      color: rgb(0.5, 0.54, 0.62),
    });
  } else {
    const paper = rgb(0.98, 0.98, 0.99);
    const ink = rgb(0.12, 0.13, 0.16);
    const muted = rgb(0.4, 0.42, 0.48);

    page.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: paper });
    page.drawRectangle({ x: 0, y: A4_H - 4, width: A4_W, height: 4, color: ACCENT });

    let y = A4_H - M;
    page.drawText("CONCEPTWEBSITE", {
      x: M,
      y,
      size: 9,
      font: fontBold,
      color: ACCENT,
    });
    y -= 22;
    page.drawText("Scan en bekijk direct online", {
      x: M,
      y,
      size: 18,
      font: fontBold,
      color: ink,
    });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: A4_W - M, y }, thickness: 0.75, color: rgb(0.88, 0.88, 0.92) });
    y -= 28;
    page.drawText(name, { x: M, y, size: 28, font: fontBold, color: ink });
    y -= 44;
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
    y -= 22;

    const qrX = (A4_W - QR_PT) / 2;
    const qrY = 220;
    const pad = 14;
    page.drawRectangle({
      x: qrX - pad,
      y: qrY - pad,
      width: QR_PT + pad * 2,
      height: QR_PT + pad * 2,
      color: rgb(1, 1, 1),
    });
    page.drawRectangle({
      x: qrX - pad,
      y: qrY - pad,
      width: QR_PT + pad * 2,
      height: QR_PT + pad * 2,
      borderColor: rgb(0.86, 0.87, 0.91),
      borderWidth: 0.75,
    });
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrDims.width, height: qrDims.height });
    let uy = qrY - 28;
    page.drawText("Controlelink", { x: M, y: uy, size: 8, font: fontBold, color: rgb(0.55, 0.56, 0.6) });
    uy -= 12;
    for (const line of wrapLines(flyerPageUrl, fontReg, 7.5, maxW)) {
      page.drawText(line, { x: M, y: uy, size: 7.5, font: fontReg, color: muted });
      uy -= 9.5;
    }
    page.drawText(PUBLIC_BRAND, {
      x: M,
      y: M - 6,
      size: 9,
      font: fontBold,
      color: rgb(0.55, 0.55, 0.58),
    });
  }

  return pdf.save();
}

import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { PUBLIC_BRAND } from "@/lib/constants";
import { resolveFlyerCopyForPdf } from "@/lib/flyer/flyer-studio-defaults";
import type { FlyerPdfTemplateId, FlyerStudioPersisted } from "@/lib/flyer/flyer-studio-schema";

export type { FlyerPdfTemplateId } from "@/lib/flyer/flyer-studio-schema";

const A4_W = 595;
const A4_H = 842;
const M = 52;
const QR_PT = 208;
const ACCENT = rgb(0.58, 0.38, 0.98);
const ACCENT_DEEP = rgb(0.42, 0.28, 0.82);

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

/** Paars vierkant + wit ruitje + woordmerk (printvriendelijk, vector). */
function drawGentrixMark(page: PDFPage, x: number, yTop: number, fontBold: PDFFont): number {
  const mark = 38;
  const purple = rgb(0.62, 0.4, 0.99);
  const y0 = yTop - mark;
  page.drawRectangle({ x, y: y0, width: mark, height: mark, color: purple });
  const cx = x + mark / 2;
  const cy = y0 + mark / 2;
  const s = mark * 0.28;
  const white = rgb(1, 1, 1);
  page.drawLine({ start: { x: cx, y: cy + s }, end: { x: cx + s, y: cy }, thickness: 2.2, color: white });
  page.drawLine({ start: { x: cx + s, y: cy }, end: { x: cx, y: cy - s }, thickness: 2.2, color: white });
  page.drawLine({ start: { x: cx, y: cy - s }, end: { x: cx - s, y: cy }, thickness: 2.2, color: white });
  page.drawLine({ start: { x: cx - s, y: cy }, end: { x: cx, y: cy + s }, thickness: 2.2, color: white });

  const wordX = x + mark + 12;
  page.drawText("GENTRIX", {
    x: wordX,
    y: yTop - 26,
    size: 19,
    font: fontBold,
    color: rgb(0.98, 0.98, 1),
  });
  return yTop - mark;
}

function drawGentrixGradientBackground(page: PDFPage): void {
  const bands = 14;
  const h = A4_H / bands;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = 0.05 + t * 0.07;
    const g = 0.04 + t * 0.06;
    const b = 0.12 + t * 0.1;
    const y = A4_H - (i + 1) * h;
    page.drawRectangle({ x: 0, y, width: A4_W, height: h + 0.5, color: rgb(r, g, b) });
  }
  page.drawRectangle({ x: 0, y: A4_H - 3, width: A4_W, height: 3, color: ACCENT });
}

function drawBadgePill(page: PDFPage, text: string, x: number, yTop: number, fontBold: PDFFont): number {
  const padX = 10;
  const padY = 5;
  const size = 8.5;
  const w = fontBold.widthOfTextAtSize(text, size) + padX * 2;
  const h = size + padY * 2;
  const y = yTop - h;
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: rgb(0.35, 0.12, 0.55),
    borderColor: ACCENT,
    borderWidth: 0.4,
  });
  page.drawText(text, {
    x: x + padX,
    y: y + 5.2,
    size,
    font: fontBold,
    color: rgb(0.98, 0.95, 1),
  });
  return y - 4;
}

function drawHeadlineAccentLine(
  page: PDFPage,
  x: number,
  y: number,
  maxW: number,
  headline: string,
  highlight: string,
  fontBold: PDFFont,
  fg: ReturnType<typeof rgb>,
  accent: ReturnType<typeof rgb>,
  size: number,
): number {
  const hi = highlight.trim();
  if (!hi) {
    return drawWrapped(page, headline, x, y, maxW, size, fontBold, fg, 4);
  }
  const hTrim = headline.trim();
  const spacerW = fontBold.widthOfTextAtSize(" ", size);
  const combinedW = (hTrim ? fontBold.widthOfTextAtSize(hTrim, size) + spacerW : 0) + fontBold.widthOfTextAtSize(hi, size);
  if (combinedW <= maxW) {
    let cx = x;
    if (hTrim) {
      page.drawText(hTrim, { x: cx, y, size, font: fontBold, color: fg });
      cx += fontBold.widthOfTextAtSize(hTrim, size);
      page.drawText(" ", { x: cx, y, size, font: fontBold, color: fg });
      cx += spacerW;
    }
    page.drawText(hi, { x: cx, y, size, font: fontBold, color: accent });
    return y - size - 10;
  }
  let y2 = y;
  if (hTrim) {
    y2 = drawWrapped(page, hTrim, x, y, maxW, size, fontBold, fg, 4);
    y2 -= 2;
  }
  y2 = drawWrapped(page, hi, x, y2, maxW, size + 0.5, fontBold, accent, 3);
  return y2;
}

/**
 * A4-flyer met QR naar `/p/{token}`. Teksten komen uit Flyerstudio (of standaarden per template).
 */
export async function buildClientFlyerPdf(input: {
  template: FlyerPdfTemplateId;
  clientDisplayName: string;
  flyerPageUrl: string;
  studio?: FlyerStudioPersisted | null;
}): Promise<Uint8Array> {
  const { template, clientDisplayName, flyerPageUrl, studio } = input;
  const name = clientDisplayName.trim() || "Jouw bedrijf";
  const copy = resolveFlyerCopyForPdf(template, studio ?? null);

  const qrDark =
    template === "gentrix" ? "#0b0b12ff" : template === "modern" ? "#18181bff" : "#18181bff";
  const qrPng = await QRCode.toBuffer(flyerPageUrl, {
    type: "png",
    width: 920,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: qrDark, light: "#ffffffff" },
  });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4_W, A4_H]);
  const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(qrPng);
  const qrDims = qrImage.scale(QR_PT / qrImage.width);

  const maxW = A4_W - M * 2;

  if (template === "gentrix") {
    drawGentrixGradientBackground(page);
    const fg = rgb(0.96, 0.97, 0.99);
    const sub = rgb(0.78, 0.8, 0.88);

    let y = A4_H - M;
    drawGentrixMark(page, M, y, fontBold);
    y -= 52;
    y = drawBadgePill(page, copy.badge.toUpperCase(), M, y, fontBold);
    y -= 18;
    y = drawHeadlineAccentLine(page, M, y, maxW, copy.headline, copy.headlineHighlight, fontBold, fg, ACCENT, 24);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: A4_W - M, y }, thickness: 0.75, color: rgb(0.35, 0.32, 0.48) });
    y -= 26;
    page.drawText(name, { x: M, y, size: 26, font: fontBold, color: fg });
    y -= 40;
    y = drawWrapped(page, copy.body, M, y, maxW, 11.5, fontReg, sub, 3.5);
    y -= 18;

    const qrX = (A4_W - QR_PT) / 2;
    const qrY = 232;
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
      borderColor: rgb(0.88, 0.82, 0.98),
      borderWidth: 0.6,
    });
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrDims.width, height: qrDims.height });
    let uy = qrY - 30;
    page.drawText("Controlelink", { x: M, y: uy, size: 8, font: fontBold, color: rgb(0.62, 0.6, 0.72) });
    uy -= 12;
    for (const line of wrapLines(flyerPageUrl, fontReg, 7.5, maxW)) {
      page.drawText(line, { x: M, y: uy, size: 7.5, font: fontReg, color: sub });
      uy -= 9.5;
    }
    page.drawText("gentrix.nl", {
      x: M,
      y: M - 6,
      size: 9,
      font: fontBold,
      color: rgb(0.55, 0.52, 0.65),
    });
    return pdf.save();
  }

  const isModern = template === "modern";

  if (isModern) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: A4_W,
      height: A4_H,
      color: rgb(0.05, 0.06, 0.1),
    });
    page.drawRectangle({ x: 0, y: A4_H - 5, width: A4_W, height: 5, color: ACCENT_DEEP });
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
    page.drawText(copy.badge.toUpperCase(), {
      x: M,
      y,
      size: 9,
      font: fontBold,
      color: ACCENT,
    });
    y -= 22;
    y = drawHeadlineAccentLine(page, M, y, maxW, copy.headline, copy.headlineHighlight, fontBold, fg, ACCENT, 18);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: A4_W - M, y }, thickness: 1, color: rgb(0.28, 0.3, 0.38) });
    y -= 28;
    page.drawText(name, { x: M, y, size: 28, font: fontBold, color: fg });
    y -= 44;
    y = drawWrapped(page, copy.body, M, y, maxW, 11, fontReg, sub, 3);
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
    page.drawRectangle({ x: 0, y: A4_H - 4, width: A4_W, height: 4, color: ACCENT_DEEP });

    let y = A4_H - M;
    page.drawText(copy.badge.toUpperCase(), {
      x: M,
      y,
      size: 9,
      font: fontBold,
      color: ACCENT_DEEP,
    });
    y -= 22;
    y = drawHeadlineAccentLine(page, M, y, maxW, copy.headline, copy.headlineHighlight, fontBold, ink, ACCENT_DEEP, 18);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: A4_W - M, y }, thickness: 0.75, color: rgb(0.88, 0.88, 0.92) });
    y -= 28;
    page.drawText(name, { x: M, y, size: 28, font: fontBold, color: ink });
    y -= 44;
    y = drawWrapped(page, copy.body, M, y, maxW, 11, fontReg, muted, 3);
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

import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import JSZip from "jszip";
import * as os from "node:os";
import * as path from "node:path";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class PromoVideoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromoVideoUnavailableError";
  }
}

/** Safari op iPhone — triggert mobiele layout / responsive breakpoints. */
const MOBILE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

/** Per clip: langzame, vloeiende scroll (~30s standaard). */
const DEFAULT_CLIP_DURATION_MS = 30_000;
const DEFAULT_SETTLE_MS = 4_000;
/** Tijd tussen kleine wheel-stappen (ms) — lager = vloeiender, meer CPU. */
const WHEEL_STEP_MS = 48;

/**
 * Scrollt met kleine wheel-events (vloeiender dan grote scrollTo-stappen).
 */
async function smoothWheelScroll(page: import("playwright").Page, durationMs: number): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(500);

  const info = await page.evaluate(() => ({
    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    vw: window.innerWidth,
    vh: window.innerHeight,
  }));

  const cx = Math.max(1, Math.floor(info.vw / 2));
  const cy = Math.max(1, Math.floor(info.vh / 2));
  await page.mouse.move(cx, cy);

  if (info.max < 12) {
    await delay(Math.min(Math.floor(durationMs * 0.9), 14_000));
    return;
  }

  const steps = Math.max(100, Math.floor(durationMs / WHEEL_STEP_MS));
  const deltaPerStep = info.max / steps;
  const pauseMs = durationMs / steps;

  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, deltaPerStep);
    await delay(pauseMs);
  }

  await delay(1400);
}

type SingleClipOptions = {
  pageUrl: string;
  viewport: { width: number; height: number };
  userAgent?: string;
  durationMs?: number;
  settleMs?: number;
};

async function recordSingleClip(
  browser: import("playwright").Browser,
  options: SingleClipOptions,
): Promise<Buffer> {
  const durationMs = options.durationMs ?? DEFAULT_CLIP_DURATION_MS;
  const settleMs = options.settleMs ?? DEFAULT_SETTLE_MS;
  const dir = await mkdtemp(path.join(os.tmpdir(), "studio-promo-clip-"));

  const context = await browser.newContext({
    viewport: options.viewport,
    userAgent: options.userAgent,
    recordVideo: {
      dir,
      size: options.viewport,
    },
  });

  try {
    const page = await context.newPage();
    await page.goto(options.pageUrl, { waitUntil: "networkidle", timeout: 90_000 });
    await delay(settleMs);
    await smoothWheelScroll(page, durationMs);
    await context.close();

    const files = await readdir(dir);
    const webm = files.find((f) => f.endsWith(".webm"));
    if (!webm) {
      throw new Error("Geen WebM na opname.");
    }
    const buffer = await readFile(path.join(dir, webm));
    await rm(dir, { recursive: true, force: true });
    return buffer;
  } catch (e) {
    await context.close().catch(() => {});
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

/**
 * Twee opnames (mobiel + desktop), langzaam en vloeiend gescrolld, in één ZIP.
 * `mobiel.webm` + `desktop.webm` voor o.a. WhatsApp (kies het passende bestand) of beide delen.
 */
export async function recordPublicSitePromoZip(pageUrl: string): Promise<Buffer> {
  if (process.env.STUDIO_PROMO_VIDEO === "0") {
    throw new PromoVideoUnavailableError(
      "Promo-video staat uit (STUDIO_PROMO_VIDEO=0). Zet de variabele niet of op 1 om opname toe te staan.",
    );
  }

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new PromoVideoUnavailableError(
      "Playwright ontbreekt. Voer in de map gentrix uit: npm install playwright && npx playwright install chromium",
    );
  }

  let browser: import("playwright").Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });

    const mobileBuf = await recordSingleClip(browser, {
      pageUrl,
      viewport: MOBILE_VIEWPORT,
      userAgent: MOBILE_SAFARI_UA,
    });

    const desktopBuf = await recordSingleClip(browser, {
      pageUrl,
      viewport: DESKTOP_VIEWPORT,
    });

    const zip = new JSZip();
    zip.file("mobiel.webm", mobileBuf);
    zip.file("desktop.webm", desktopBuf);
    const out = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    return Buffer.from(out);
  } catch (e) {
    if (e instanceof PromoVideoUnavailableError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (/Executable doesn't exist|browserType\.launch|chromium/i.test(msg)) {
      throw new PromoVideoUnavailableError(
        "Chromium voor Playwright ontbreekt. Voer uit: npx playwright install chromium",
      );
    }
    throw e;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

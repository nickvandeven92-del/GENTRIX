import type {
  ClaudeTailwindMarketingSiteOutput,
  ClaudeTailwindPageOutput,
  MasterPromptPageConfig,
  TailwindPageConfig,
  TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { isLegacyTailwindPageConfig, slugifyToSectionId } from "@/lib/ai/tailwind-sections-schema";

function sectionNameToStableId(sectionName: string, index: number): string {
  const base = sectionName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base.length > 0 ? base : `section-${index + 1}`;
}

/** Unieke id's voor upgrade-prompt (zelfde basis als sectienaam-slug, plus -2, -3 bij botsingen). */
export function stableIdsForUpgradeSections(sectionNames: string[]): string[] {
  const used = new Set<string>();
  return sectionNames.map((name, i) => {
    const base = sectionNameToStableId(name, i);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return id;
  });
}

const ROOT_TAGS_WITH_ID = new Set([
  "section",
  "article",
  "main",
  "header",
  "div",
  "nav",
  "footer",
]);

function slugifyIdSegment(raw: string): string {
  const t = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return t.length > 0 ? t : "section";
}

/** Zorgt voor unieke JSON-`id`'s (dubbele model-output). */
export function ensureUniqueSectionIds(
  sections: ClaudeTailwindPageOutput["sections"],
): ClaudeTailwindPageOutput["sections"] {
  const used = new Set<string>();
  return sections.map((row, index) => {
    const base = slugifyIdSegment(row.id || row.name || `section-${index + 1}`);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return { ...row, id };
  });
}

/**
 * Zet `id` op het eerste root-element (meestal `<section>`) gelijk aan de JSON-sectie-id.
 */
export function withRootIdOnSectionHtml(html: string, stableId: string): string {
  const q = stableId.replace(/"/g, "&quot;");
  const idAttrPattern = /\bid\s*=\s*["']([^"']*)["']/i;
  return html.replace(
    /^\s*<([a-zA-Z][\w:-]*)(\s[^>]*)?>/,
    (full, tag: string, attrs: string | undefined) => {
      const t = tag.toLowerCase();
      if (!ROOT_TAGS_WITH_ID.has(t)) {
        return full;
      }
      const a = attrs ?? "";
      const idMatch = a.match(idAttrPattern);
      if (idMatch) {
        if (idMatch[1] === stableId) {
          return full;
        }
        const na = a.replace(idAttrPattern, ` id="${q}"`);
        return `<${tag}${na}>`;
      }
      return `<${tag} id="${q}"${a}>`;
    },
  );
}

/**
 * Voegt meerdere \`class="…"\` op dezelfde \`<nav>\` of \`<header>\` samen tot één attribuut (geldige HTML).
 * Claude combineert soms scroll-overlay + vaste utilities tot twee \`class\`-attributen.
 */
/**
 * Modellen zetten soms per ongeluk `open: true` / `menuOpen: true` in `x-data`, waardoor het mobiele menu
 * fullscreen opent vóór interactie. Corrigeer bekende toggles naar `false` (alleen binnen `x-data`-waarden).
 */
const ALPINE_NAV_TOGGLE_TRUE_RE =
  /\b(open|menuOpen|navOpen|mobileOpen|showMenu|drawerOpen|sidebarOpen|panelOpen|mobileNavOpen|sideMenuOpen)\s*:\s*true\b/g;

export function fixAlpineNavToggleDefaultsInXData(html: string): string {
  const fixInner = (inner: string) => inner.replace(ALPINE_NAV_TOGGLE_TRUE_RE, "$1: false");
  let out = html.replace(/\bx-data\s*=\s*"([^"]*)"/gi, (full, inner: string) => {
    const next = fixInner(inner);
    return next === inner ? full : `x-data="${next}"`;
  });
  out = out.replace(/\bx-data\s*=\s*'([^']*)'/gi, (full, inner: string) => {
    const next = fixInner(inner);
    return next === inner ? full : `x-data='${next}'`;
  });
  return out;
}

/**
 * Verwijdert decoratieve “SCROLL”-cues onderaan hero’s (model-template; blijft zichtbaar i.c.m. video-loop).
 * Alleen nodes waar de tekstinhoud **uitsluitend** `SCROLL` is — geen woorden in lopende zinnen.
 */
export function stripDecorativeScrollCueMarkup(html: string): string {
  if (!html.includes("SCROLL")) return html;
  let s = html;
  s = s.replace(/<(span|p|div|a|button|strong|em|label)\b[^>]{0,360}?>\s*SCROLL\s*<\/\1>/gi, "");
  s = s.replace(/>[\s\u00A0\u200B]*SCROLL[\s\u00A0\u200B]*</g, "><");
  return s;
}

export function mergeDuplicateClassOnChromeTags(html: string): string {
  return html.replace(/<(nav|header)(\s[^>]*?)>/gi, (full, tag: string, inner: string) => {
    const doubleQuoted = [...inner.matchAll(/\bclass\s*=\s*"([^"]*)"/gi)];
    const singleQuoted = [...inner.matchAll(/\bclass\s*=\s*'([^']*)'/gi)];
    if (doubleQuoted.length + singleQuoted.length < 2) {
      return full;
    }
    const parts: string[] = [];
    for (const m of doubleQuoted) {
      for (const p of m[1].split(/\s+/).filter(Boolean)) {
        parts.push(p);
      }
    }
    for (const m of singleQuoted) {
      for (const p of m[1].split(/\s+/).filter(Boolean)) {
        parts.push(p);
      }
    }
    const merged = [...new Set(parts)].join(" ");
    const without = inner
      .replace(/\bclass\s*=\s*"[^"]*"/gi, " ")
      .replace(/\bclass\s*=\s*'[^']*'/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const newInner = without.length > 0 ? `class="${merged}" ${without}` : `class="${merged}"`;
    return `<${tag} ${newInner}>`;
  });
}

function pickFallbackFragment(validIds: Set<string>): string {
  for (const k of ["footer", "contact", "hero", "features", "faq"]) {
    if (validIds.has(k)) return k;
  }
  const first = [...validIds].find((x) => x !== "top");
  return first ?? "footer";
}

/** Alle `id="…"` in markup — nav mag naar nested ankers wijzen, niet alleen naar JSON-sectie-id's. */
export function collectHtmlElementIds(html: string): Set<string> {
  const out = new Set<string>();
  const re = /\bid\s*=\s*(["'])([^"']*)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const v = m[2]?.trim();
    if (v) out.add(v);
  }
  return out;
}

const RESERVED_SINGLE_SEGMENT_PATHS = new Set(
  ["portal", "boek", "winkel", "admin", "api", "login", "home", "dashboard", "site", "_next"].map((s) =>
    s.toLowerCase(),
  ),
);

/**
 * Modellen zetten vaak `href="/site/slug"` of `https://…/site/slug` (zonder `#`) op elk menu-item.
 * In de srcDoc-iframe scrollt dat telkens naar boven → alle links voelen identiek. Zet om naar `#…`.
 * Ook `/diensten` → `#diensten` als die id bestaat.
 */
export function repairSamePagePathHrefsInHtml(html: string, validIds: Set<string>): string {
  return html.replace(/href\s*=\s*(["'])([^"']*)\1/gi, (full, quote: string, inner: string) => {
    const next = pathOrAbsoluteSiteHrefToHash(inner, validIds);
    if (next == null) return full;
    return `href=${quote}${next}${quote}`;
  });
}

function pathOrAbsoluteSiteHrefToHash(raw: string, validIds: Set<string>): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("#") || /^mailto:|^tel:|^javascript:/i.test(trimmed)) return null;
  if (trimmed.includes("__STUDIO_")) return null;

  let pathname = "";
  let hash = "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      pathname = u.pathname || "";
      hash = u.hash && u.hash.length > 1 ? safeDecodeFragment(u.hash.slice(1)) : "";
    } catch {
      return null;
    }
    if (!pathname.toLowerCase().startsWith("/site/")) return null;
  } else {
    const hashIdx = trimmed.indexOf("#");
    let pathPart = trimmed;
    if (hashIdx >= 0) {
      hash = safeDecodeFragment(trimmed.slice(hashIdx + 1));
      pathPart = trimmed.slice(0, hashIdx);
    }
    pathname = (pathPart.split("?")[0] ?? "").trim();
    if (!pathname.startsWith("/")) return null;
  }

  const pl = pathname.toLowerCase();
  if (
    pl.startsWith("/portal") ||
    pl.startsWith("/boek") ||
    pl.startsWith("/winkel") ||
    pl.startsWith("/admin") ||
    pl.startsWith("/api") ||
    pl.startsWith("/_next") ||
    pl === "/login" ||
    pl.startsWith("/login/") ||
    pl === "/home" ||
    pl === "/dashboard"
  ) {
    return null;
  }

  const fb = pickFallbackFragment(validIds);

  if (pl === "/site" || pl === "/site/") {
    if (hash) {
      if (hash === "top" || validIds.has(hash)) return `#${hash}`;
      return `#${fb}`;
    }
    return validIds.has("top") ? `#top` : `#${fb}`;
  }

  if (pl.startsWith("/site/")) {
    const rest = pathname.slice("/site/".length).split("/").filter(Boolean);
    if (rest.length > 1) return null;
    if (hash) {
      if (hash === "top" || validIds.has(hash)) return `#${hash}`;
      return `#${fb}`;
    }
    return validIds.has("top") ? `#top` : `#${fb}`;
  }

  if (pathname === "/" || pathname === "") {
    return validIds.has("top") ? `#top` : `#${fb}`;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) {
    const seg = safeDecodeFragment(segments[0]!);
    if (RESERVED_SINGLE_SEGMENT_PATHS.has(seg.toLowerCase())) return null;
    if (seg === "top" || validIds.has(seg)) return `#${seg}`;
    const segKey = slugifyIdSegment(seg);
    for (const vid of validIds) {
      if (slugifyIdSegment(vid) === segKey) return `#${vid}`;
    }
    return null;
  }

  return null;
}

function safeDecodeFragment(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Vervangt `href="#onbekend"` door een geldige anker-id uit de pagina.
 */
export function repairInternalLinksInHtml(html: string, validIds: Set<string>): string {
  const fb = pickFallbackFragment(validIds);
  return html.replace(/href\s*=\s*(["'])(#[^"']*)\1/gi, (_m, quote: string, ref: string) => {
    const inner = ref.slice(1);
    const frag = inner.split(/[?#]/)[0] ?? "";
    if (frag === "") {
      return `href=${quote}#${fb}${quote}`;
    }
    if (frag === "top" || validIds.has(frag)) {
      return `href=${quote}#${frag}${quote}`;
    }
    return `href=${quote}#${fb}${quote}`;
  });
}

const HERO_VIEWPORT_MIN_CLASS = "min-h-[72vh] md:min-h-[80vh]";

/** `min-h-0` telt niet als viewport-hoogte voor de hero (layout-truc). */
function hasHeroViewportMinHeightClass(classStr: string): boolean {
  const tokens = classStr.split(/\s+/).filter(Boolean);
  return tokens.some((t) => {
    if (t === "min-h-0") return false;
    return /^min-h-/.test(t);
  });
}

/**
 * Voegt minimale hero-viewport-hoogte toe als het model geen `min-h-*` (behalve min-h-0) zette.
 * Voorkomt het patroon: smalle gekleurde strook + groot leeg wit gebied in het iframe.
 */
export function ensureHeroRootMinViewportClass(html: string): string {
  return html.replace(
    /^\s*<([a-zA-Z][\w:-]*)(\s[^>]*)>/,
    (full, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (!ROOT_TAGS_WITH_ID.has(t)) return full;
      const classMatch = attrs.match(/\bclass\s*=\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1/i);
      if (classMatch) {
        const quote = classMatch[1];
        const existing = classMatch[2].replace(/\\(.)/g, "$1");
        if (hasHeroViewportMinHeightClass(existing)) return full;
        const merged = `${existing} ${HERO_VIEWPORT_MIN_CLASS}`.trim();
        const newAttrs = attrs.replace(classMatch[0], `class=${quote}${merged}${quote}`);
        return `<${tag}${newAttrs}>`;
      }
      const trimmed = attrs.trim();
      const sp = trimmed.length ? " " : "";
      return `<${tag}${sp}${trimmed} class="${HERO_VIEWPORT_MIN_CLASS}">`;
    },
  );
}

/**
 * Na Zod-validatie: stabiele id's, root-id in markup, werkende interne links.
 */
/**
 * Landings- + contactpagina los post-processen (unieke id’s, interne #ankers per pagina).
 */
export function postProcessClaudeTailwindMarketingSite(
  page: ClaudeTailwindMarketingSiteOutput,
): ClaudeTailwindMarketingSiteOutput {
  const landing = postProcessClaudeTailwindPage({ config: page.config, sections: page.sections });
  const contact = postProcessClaudeTailwindPage({ config: page.config, sections: page.contactSections });
  const marketingPagesRaw = page.marketingPages;
  const marketingPages =
    marketingPagesRaw != null && Object.keys(marketingPagesRaw).length > 0
      ? Object.fromEntries(
          Object.entries(marketingPagesRaw).map(([k, secs]) => [
            k,
            postProcessClaudeTailwindPage({ config: page.config, sections: secs }).sections,
          ]),
        )
      : undefined;
  return {
    config: landing.config,
    sections: landing.sections,
    contactSections: contact.sections,
    ...(marketingPages != null ? { marketingPages } : {}),
  };
}

export function postProcessClaudeTailwindPage(page: ClaudeTailwindPageOutput): ClaudeTailwindPageOutput {
  const withIds = ensureUniqueSectionIds(page.sections);
  const combined = withIds.map((row) => withRootIdOnSectionHtml(row.html, row.id)).join("\n");

  const validIds = new Set(withIds.map((s) => s.id));
  validIds.add("top");
  for (const id of collectHtmlElementIds(combined)) {
    validIds.add(id);
  }

  const sectionsLinked = withIds.map((row) => {
    const html0 = withRootIdOnSectionHtml(row.html, row.id);
    const html0b = repairSamePagePathHrefsInHtml(html0, validIds);
    const html1 = repairInternalLinksInHtml(html0b, validIds);
    const html2 = mergeDuplicateClassOnChromeTags(html1);
    const html2b = fixAlpineNavToggleDefaultsInXData(html2);
    const html2c = stripDecorativeScrollCueMarkup(html2b);
    const html3 = row.id === "hero" ? ensureHeroRootMinViewportClass(html2c) : html2c;
    return { ...row, html: html3 };
  });

  return { ...page, sections: sectionsLinked };
}

const STREAMING_PREVIEW_PLACEHOLDER_MASTER_CONFIG: MasterPromptPageConfig = {
  style: "studio_streaming_preview",
  font: "Inter, ui-sans-serif, system-ui, sans-serif",
  theme: {
    primary: "#0f766e",
    accent: "#b45309",
    secondary: "#64748b",
  },
};

/**
 * Streaming site-studio: pas dezelfde HTML-postprocess toe als op de afgeronde JSON, zodat preview tijdens
 * genereren geen “ruwe” modelfouten toont (Alpine menu standaard open, dubbele class op nav/header, enz.).
 */
export function postProcessTailwindSectionsForStreamingPreview(
  sections: readonly TailwindSection[],
  config: TailwindPageConfig | null,
): TailwindSection[] {
  if (sections.length === 0) return [];
  const masterConfig: MasterPromptPageConfig =
    config != null && !isLegacyTailwindPageConfig(config) ? config : STREAMING_PREVIEW_PLACEHOLDER_MASTER_CONFIG;
  const page: ClaudeTailwindPageOutput = {
    config: masterConfig,
    sections: sections.map((s, i) => ({
      id: s.id?.trim() ? s.id.trim() : slugifyToSectionId(s.sectionName, i),
      html: s.html,
      name: s.sectionName.trim() || undefined,
    })),
  };
  const out = postProcessClaudeTailwindPage(page);
  return out.sections.map((row, i) => ({
    id: row.id,
    sectionName: row.name?.trim() || sections[i]?.sectionName?.trim() || row.id,
    html: row.html,
  }));
}

/** Alleen voor upgrade-prompt JSON (kleinere payload). */
export function normalizeHtmlWhitespaceForUpgradePrompt(html: string): string {
  return html.replace(/[\t\n\r]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

const DEFAULT_FALLBACK_PRIMARY = "#0f766e";
const DEFAULT_FALLBACK_ACCENT = "#b45309";

function sanitizeThemeHex(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const t = raw.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(t) ? t : fallback;
}

function extractThemeHexesFromParsedRoot(o: Record<string, unknown>): { primary: string; accent: string } {
  const cfg = o.config;
  if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg)) {
    return { primary: DEFAULT_FALLBACK_PRIMARY, accent: DEFAULT_FALLBACK_ACCENT };
  }
  const theme = (cfg as Record<string, unknown>).theme;
  if (theme === null || typeof theme !== "object" || Array.isArray(theme)) {
    return { primary: DEFAULT_FALLBACK_PRIMARY, accent: DEFAULT_FALLBACK_ACCENT };
  }
  const th = theme as Record<string, unknown>;
  return {
    primary: sanitizeThemeHex(th.primary, DEFAULT_FALLBACK_PRIMARY),
    accent: sanitizeThemeHex(th.accent, DEFAULT_FALLBACK_ACCENT),
  };
}

/**
 * Minimale contactpagina + nav (zelfde studio-tokens als het model) als `contactSections` ontbreekt of leeg is.
 * Formulier alleen hier — homepage en marketing-subpagina's blijven form-vrij.
 */
export function buildDefaultClaudeMarketingContactSectionRow(primary: string, accent: string): {
  id: string;
  name: string;
  html: string;
} {
  return {
    id: "contact",
    name: "Contact",
    html: `<section id="contact" class="bg-stone-50">
  <header class="border-b border-stone-200 bg-white/90 backdrop-blur">
    <nav class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 text-sm font-medium text-stone-700">
      <a href="__STUDIO_SITE_BASE__" class="font-semibold" style="color:${primary}">Home</a>
      <div class="flex flex-wrap items-center gap-3 md:gap-4">
        <a href="__STUDIO_SITE_BASE__/wat-wij-doen" class="hover:opacity-80">Wat wij doen</a>
        <a href="__STUDIO_SITE_BASE__/werkwijze" class="hover:opacity-80">Werkwijze</a>
        <a href="__STUDIO_SITE_BASE__/over-ons" class="hover:opacity-80">Over ons</a>
        <a href="__STUDIO_SITE_BASE__/faq" class="hover:opacity-80">FAQ</a>
        <a href="__STUDIO_CONTACT_PATH__" class="rounded-md px-3 py-1.5 text-white shadow-sm hover:opacity-90" style="background:${accent}">Contact</a>
      </div>
    </nav>
  </header>
  <div class="mx-auto max-w-xl px-4 py-16 md:py-24">
    <h1 class="text-3xl font-semibold tracking-tight text-stone-900">Neem contact op</h1>
    <p class="mt-3 text-stone-600">Laat een bericht achter; we nemen zo snel mogelijk contact met u op.</p>
    <form class="mt-10 space-y-5" method="post">
      <div>
        <label for="gentrix-contact-name" class="block text-sm font-medium text-stone-700">Naam</label>
        <input id="gentrix-contact-name" name="name" type="text" required autocomplete="name" class="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400" />
      </div>
      <div>
        <label for="gentrix-contact-email" class="block text-sm font-medium text-stone-700">E-mail</label>
        <input id="gentrix-contact-email" name="email" type="email" required autocomplete="email" class="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400" />
      </div>
      <div>
        <label for="gentrix-contact-message" class="block text-sm font-medium text-stone-700">Bericht</label>
        <textarea id="gentrix-contact-message" name="message" rows="5" required class="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"></textarea>
      </div>
      <button type="submit" class="inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 md:w-auto" style="background:${primary}">Versturen</button>
    </form>
  </div>
</section>`,
  };
}

function isPlainJsonObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Modellen nesten soms per ongeluk sectie-arrays (bv. FAQ-items als `[[{…}], …]`).
 * Maakt één vlakke lijst van rijen; diepe nesting wordt recursief uitgeklapt.
 */
function flattenClaudeSectionRowArray(input: unknown): unknown[] {
  if (!Array.isArray(input)) return [];
  const out: unknown[] = [];
  for (const item of input) {
    if (Array.isArray(item)) {
      out.push(...flattenClaudeSectionRowArray(item));
    } else {
      out.push(item);
    }
  }
  return out;
}

function filterRowsWithIdAndHtml(rows: unknown[]): unknown[] {
  return rows.filter((row) => {
    if (!isPlainJsonObject(row)) return false;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const html = typeof row.html === "string" ? row.html.trim() : "";
    return id.length > 0 && html.length > 0;
  });
}

/**
 * Normaliseert `sections`, `contactSections` en elke `marketingPages[*]` vóór Zod-parse:
 * geneste arrays worden platgeslagen; rijen zonder `id`+`html` vallen weg.
 */
export function normalizeClaudeSectionArraysInParsedJson(parsed: unknown): unknown {
  if (!isPlainJsonObject(parsed)) {
    return parsed;
  }
  const o = { ...parsed };

  if (Array.isArray(o.sections)) {
    o.sections = filterRowsWithIdAndHtml(flattenClaudeSectionRowArray(o.sections));
  }
  if (Array.isArray(o.contactSections)) {
    o.contactSections = filterRowsWithIdAndHtml(flattenClaudeSectionRowArray(o.contactSections));
  }
  if (o.marketingPages != null && isPlainJsonObject(o.marketingPages)) {
    const mp = o.marketingPages as Record<string, unknown>;
    const next: Record<string, unknown> = { ...mp };
    for (const [k, v] of Object.entries(mp)) {
      if (Array.isArray(v)) {
        next[k] = filterRowsWithIdAndHtml(flattenClaudeSectionRowArray(v));
      }
    }
    o.marketingPages = next;
  }
  return o;
}

function marketingContactSectionsArrayLooksValid(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.every((row) => {
    if (row === null || typeof row !== "object" || Array.isArray(row)) return false;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const html = typeof r.html === "string" ? r.html.trim() : "";
    return id.length > 0 && html.length > 0;
  });
}

function marketingContactSectionsIncludeForm(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  const joined = raw
    .map((row) => {
      if (row === null || typeof row !== "object" || Array.isArray(row)) return "";
      const h = (row as Record<string, unknown>).html;
      return typeof h === "string" ? h : "";
    })
    .join("\n");
  return /<form\b/i.test(joined);
}

/**
 * Vult ontbrekende `contactSections` aan vóór Zod-parse (marketing multi-page).
 * Voorkomt schema-fouten wanneer het model het veld weglaat; het formulier blijft op de contact-subroute.
 */
export function ensureClaudeMarketingSiteJsonHasContactSections(parsed: unknown): unknown {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }
  const o = parsed as Record<string, unknown>;
  if (
    marketingContactSectionsArrayLooksValid(o.contactSections) &&
    marketingContactSectionsIncludeForm(o.contactSections)
  ) {
    return parsed;
  }
  const { primary, accent } = extractThemeHexesFromParsedRoot(o);
  const row = buildDefaultClaudeMarketingContactSectionRow(primary, accent);
  return { ...o, contactSections: [row] };
}

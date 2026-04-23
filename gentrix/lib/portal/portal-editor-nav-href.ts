/**
 * Minimale pagina-vorm voor nav-resolutie in het klantportaal (iframe-preview).
 * Houd gelijk aan `PortalEditorPage` in `portal-visual-site-editor.tsx`.
 */
export type PortalEditorNavPage = {
  id: string;
  label: string;
};

const MARKETING_PAGE_SLUG_SYNONYMS: Record<string, readonly string[]> = {
  assortiment: ["collectie"],
  catalogus: ["collectie"],
  aanbod: ["collectie"],
  shop: ["collectie"],
  producten: ["collectie"],
  diensten: ["wat-wij-doen"],
  services: ["wat-wij-doen"],
  methode: ["werkwijze"],
  procedure: ["werkwijze"],
  about: ["over-ons"],
  overons: ["over-ons"],
  veelgestelde: ["faq"],
  veelgesteldevragen: ["faq"],
  help: ["faq"],
  retour: ["service-retour"],
  garantie: ["service-retour"],
};

export function slugifySegment(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function decodeUriPathSegment(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * Eerste logische routenaam uit een pad (na optionele `/site/{slug}/`-prefix).
 * `applyStudioPublishedPathPlaceholders` zet o.a. `__STUDIO_SITE_BASE__/faq` om naar `/site/{slug}/faq`.
 */
export function primarySitePathSegment(path: string): string | null {
  const clean = (path.split("?")[0] ?? "").trim();
  if (!clean || clean === "/") return null;
  const parts = clean.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0]!.toLowerCase() === "site") {
    if (parts.length >= 3) return decodeUriPathSegment(parts[2]!);
    return null;
  }
  return decodeUriPathSegment(parts[0]!);
}

function findPageIdForSegment(seg: string, pages: PortalEditorNavPage[]): string | null {
  if (!seg) return null;

  if (seg === "contact") {
    return pages.find((p) => p.id.startsWith("contact:") || p.id === "contact")?.id ?? null;
  }

  const direct = pages.find((p) => {
    if (p.id.startsWith("marketing:")) {
      const key = (p.id.split(":")[1] ?? "").toLowerCase();
      return key === seg || slugifySegment(p.label) === seg;
    }
    return slugifySegment(p.label) === seg;
  });
  if (direct) return direct.id;

  const synonymTargets =
    MARKETING_PAGE_SLUG_SYNONYMS[seg] ??
    MARKETING_PAGE_SLUG_SYNONYMS[seg.replace(/-/g, "")] ??
    [];
  for (const target of synonymTargets) {
    const match = pages.find((p) => {
      if (!p.id.startsWith("marketing:")) return false;
      const key = (p.id.split(":")[1] ?? "").toLowerCase();
      return key === target || slugifySegment(p.label) === target;
    });
    if (match) return match.id;
  }
  return null;
}

/**
 * Nav-href → editor-pagina-id. Ondersteunt `/site/{slug}/…`, enkelvoudige paden, hashes en absolute URL's.
 */
export function resolveNavHrefToPageId(href: string, pages: PortalEditorNavPage[]): string | null {
  let working = href.trim();
  if (!working) return null;

  let fragment = "";
  try {
    if (/^https?:\/\//i.test(working)) {
      const u = new URL(working);
      fragment = u.hash && u.hash.length > 1 ? decodeURIComponent(u.hash.slice(1)) : "";
      working = u.pathname || "/";
    } else {
      const hashIdx = working.indexOf("#");
      if (hashIdx >= 0) {
        fragment = decodeURIComponent(working.slice(hashIdx + 1));
        working = working.slice(0, hashIdx);
      }
    }
  } catch {
    /* ignore */
  }

  const path = (working.split("?")[0] ?? "").trim();

  if (!path || path === "/") {
    if (fragment) {
      const hit = findPageIdForSegment(slugifySegment(fragment), pages);
      if (hit) return hit;
      if (!path) return null;
    }
    return pages.find((p) => p.id.startsWith("main"))?.id ?? null;
  }

  const segRaw = primarySitePathSegment(path);
  if (!segRaw) {
    if (fragment) {
      const hit = findPageIdForSegment(slugifySegment(fragment), pages);
      if (hit) return hit;
    }
    return pages.find((p) => p.id.startsWith("main"))?.id ?? null;
  }

  const seg = slugifySegment(segRaw);
  if (!seg) return pages.find((p) => p.id.startsWith("main"))?.id ?? null;

  return findPageIdForSegment(seg, pages);
}

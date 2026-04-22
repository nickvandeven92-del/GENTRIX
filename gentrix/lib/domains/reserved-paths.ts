/**
 * Top-level pathsegmenten die **nooit** door de “pretty URL”-rewrite van een klantsite opgeslokt mogen worden.
 *
 * Nieuwe klantsites gebruiken korte URL’s (`gentrix.nl/werkwijze` i.p.v. `gentrix.nl/site/home/werkwijze`);
 * deze set beschermt alle bestaande app-shell-, auth- en public-routes tegen collisies
 * met marketingpagina-slugs uit de generator (`wat-wij-doen`, `werkwijze`, enz.).
 *
 * Houd deze lijst in sync met `app/` (top-level mappen) + route-groups die top-level paden blootstellen.
 */
const RESERVED_TOP_LEVEL_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  // Internals / Next.js + static
  "_next",
  "api",
  "auth",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "manifest.json",
  // App-shell (beheerder/editor)
  "admin",
  "dashboard",
  "generator",
  "generate",
  "settings",
  "login",
  "home",
  "wachtwoord-instellen",
  "wachtwoord-vergeten",
  "agenda",
  "portal",
  // Publieke routes die geen onderdeel zijn van de klantsite
  "site",
  "boek",
  "boek-venster",
  "booking-app",
  "winkel",
  "preview",
  "p",
]);

const STATIC_ASSET_EXT_RE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|map|txt|xml|pdf|woff2?|ttf|otf|mp4|webm|json)$/i;

/**
 * `true` als het eerste pathsegment een gereserveerde app-route is en dus **niet** mag worden
 * gerouteerd als marketingpagina van de landingssite (bv. `/admin`, `/api/...`, `/site/...`).
 */
export function isReservedTopLevelPath(pathname: string): boolean {
  if (!pathname || pathname === "/" || pathname === "") return true;
  if (STATIC_ASSET_EXT_RE.test(pathname)) return true;
  const seg0 = pathname.replace(/^\/+/, "").split("/")[0] ?? "";
  if (!seg0) return true;
  return RESERVED_TOP_LEVEL_PATH_SEGMENTS.has(seg0.toLowerCase());
}

/**
 * `true` wanneer het pad zinvol door de pretty-URL-rewrite van een landingssite kan worden afgehandeld:
 * enkelvoudige top-level paden (`/werkwijze`, `/contact`) — niet `/foo/bar/baz`.
 */
export function isCandidateForLandingSitePrettyUrl(pathname: string): boolean {
  if (isReservedTopLevelPath(pathname)) return false;
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return false;
  const segments = trimmed.split("/").filter(Boolean);
  // Alleen 1-segment (marketing of contact). Dieper laten we aan de bestaande routes over.
  return segments.length === 1;
}

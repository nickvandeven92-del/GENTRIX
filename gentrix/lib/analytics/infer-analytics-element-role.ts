export type AnalyticsElementRole =
  | "nav_link"
  | "nav_cta"
  | "hero_cta"
  | "section_cta"
  | "contact_cta"
  | "module_cta"
  | "product_tile"
  | "other";

const ROLE_ORDER: { test: (id: string) => boolean; role: AnalyticsElementRole }[] = [
  {
    test: (id) =>
      id === "nav-cta" || id.startsWith("nav-cta:") || id.startsWith("nav:cta") || id.startsWith("nav_cta:"),
    role: "nav_cta",
  },
  {
    test: (id) =>
      id.startsWith("nav-link-") || id.startsWith("nav:link:") || id.startsWith("nav_link:"),
    role: "nav_link",
  },
  { test: (id) => id.startsWith("nav_module:"), role: "nav_link" },
  { test: (id) => id.startsWith("hero:") || id.includes("hero_"), role: "hero_cta" },
  { test: (id) => id.startsWith("contact:") || id.includes("contact_"), role: "contact_cta" },
  { test: (id) => id.startsWith("webshop:product_tile") || id.startsWith("product_tile:"), role: "product_tile" },
  { test: (id) => id.startsWith("webshop:section") || id.startsWith("webshop:primary"), role: "module_cta" },
  { test: (id) => id.startsWith("webshop:"), role: "module_cta" },
  { test: (id) => id.startsWith("module_cta:") || (id.startsWith("module:") && id.includes("cta")), role: "module_cta" },
  { test: (id) => id.startsWith("section:") || id.startsWith("section_"), role: "section_cta" },
  { test: (id) => id.startsWith("module:"), role: "module_cta" },
  { test: (id) => id.startsWith("booking:") || id.startsWith("appointments:"), role: "module_cta" },
];

/**
 * Bepaalt `element_role` op basis van `data-analytics` string (zonder DOM).
 * Niet gelijk aan server-side; wel stabiel.
 */
export function inferAnalyticsElementRoleFromId(analyticsId: string | null | undefined): AnalyticsElementRole {
  if (analyticsId == null) return "other";
  const id = String(analyticsId).trim();
  if (!id) return "other";
  for (const { test, role } of ROLE_ORDER) {
    if (test(id)) return role;
  }
  return "other";
}

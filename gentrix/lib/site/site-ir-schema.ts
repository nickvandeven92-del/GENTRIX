import { z } from "zod";
import { sectionIdSchema } from "@/lib/ai/tailwind-sections-schema";
import { resolveSiteBlueprintId } from "@/lib/site/site-blueprint-registry";

export const SITE_IR_SCHEMA_VERSION = 1 as const;

/** Publieke marketing- en module-routes (structuur; geen ontwerp). */
export const siteIrRouteKeySchema = z.enum([
  "public_landing",
  "public_contact",
  /** Publieke app-route `/boek/{slug}` — altijd capability; CRM stuurt activatie/inactive UI. */
  "public_booking",
  /** Publieke app-route `/winkel/{slug}` — altijd capability. */
  "public_shop",
]);

export const siteIrPageKindSchema = z.enum([
  "marketing_landing",
  "contact_page",
  "module_booking",
  "module_shop",
]);

const siteIrRouteDescriptorSchema = z
  .object({
    routeKey: siteIrRouteKeySchema,
    /** Pad op de gepubliceerde site, bv. `/` of `/contact`. */
    path: z.string().min(1).max(64),
    kind: siteIrPageKindSchema,
  })
  .strict();

/** Welke routes deze snapshot/HTML-dekking heeft (generator + validatie). */
export const siteIrActiveRoutesSchema = z.array(siteIrRouteKeySchema).min(1).max(16);

export const siteIrPrimaryPageSchema = z
  .object({
    routeKey: siteIrRouteKeySchema,
    kind: siteIrPageKindSchema,
  })
  .strict();

export const siteIrModuleSlotSchema = z
  .object({
    slot: z.enum(["before_footer", "after_hero", "primary_nav_actions"]),
    moduleId: z.string().min(1).max(48),
    intent: z.enum(["canonical_section", "embedded_fragment"]),
  })
  .strict();

export const siteIrV1Schema = z
  .object({
    schemaVersion: z.literal(SITE_IR_SCHEMA_VERSION),
    blueprintId: z.string().min(1).max(64),
    /** Branche-id uit generator-pipeline (optioneel). */
    detectedIndustryId: z.string().min(1).max(64).optional(),
    /**
     * Canonieke marketing-sectievolgorde (permutatie van snapshot-secties).
     * Leidend voor compose; `composition.sectionIdsOrdered` blijft hiermee gesynchroniseerd.
     */
    sectionIdsOrdered: z.array(sectionIdSchema).min(1).max(24).optional(),
    primaryPage: siteIrPrimaryPageSchema,
    /**
     * Actieve publieke routes voor deze site (minimaal primary).
     * Ontbreekt op oude snapshots: afleiden uit `contactSections` in payload/snapshot.
     */
    activeRoutes: siteIrActiveRoutesSchema.optional(),
    /** Optioneel register voor tooling/export; geen layout-voorschrift. */
    routes: z.array(siteIrRouteDescriptorSchema).max(16).optional(),
    moduleSlots: z.array(siteIrModuleSlotSchema).max(24),
  })
  .strict();

export type SiteIrV1 = z.infer<typeof siteIrV1Schema>;
export type SiteIrRouteKey = z.infer<typeof siteIrRouteKeySchema>;

export type BuildSiteIrV1Input = {
  blueprintId?: string | null;
  detectedIndustryId?: string | null;
  /** Marketing-sectievolgorde; wordt in snapshot altijd gelijk gehouden aan `composition.sectionIdsOrdered`. */
  sectionIdsOrdered?: readonly string[] | null;
  /**
   * `true` wanneer er een aparte contactpagina (`contactSections`) is.
   * `false` = legacy one-pager zonder vaste `/contact`-payload. Standaard `true` (studio-marketing).
   */
  hasDedicatedContactPage?: boolean | null;
};

/**
 * Deterministische Site IR v1 — geen HTML; beschrijft blueprint + primaire route + module-slots + optioneel volgorde.
 */
export function buildSiteIrV1(input?: BuildSiteIrV1Input): SiteIrV1 {
  const blueprint = resolveSiteBlueprintId(input?.blueprintId ?? undefined);
  const industry = input?.detectedIndustryId?.trim();
  const order = input?.sectionIdsOrdered?.filter((x) => typeof x === "string" && x.length > 0);
  const includeContactRoute = input?.hasDedicatedContactPage !== false;
  const baseActive = includeContactRoute
    ? (["public_landing", "public_contact"] as const)
    : (["public_landing"] as const);
  const activeRoutes = [...baseActive, "public_booking", "public_shop"] as const;
  const baseRoutes = includeContactRoute
    ? ([
        { routeKey: "public_landing" as const, path: "/", kind: "marketing_landing" as const },
        { routeKey: "public_contact" as const, path: "/contact", kind: "contact_page" as const },
      ] as const)
    : ([{ routeKey: "public_landing" as const, path: "/", kind: "marketing_landing" as const }] as const);
  const moduleRoutes = [
    { routeKey: "public_booking" as const, path: "/boek", kind: "module_booking" as const },
    { routeKey: "public_shop" as const, path: "/winkel", kind: "module_shop" as const },
  ] as const;
  const routes = [...baseRoutes, ...moduleRoutes];
  const raw: SiteIrV1 = {
    schemaVersion: SITE_IR_SCHEMA_VERSION,
    blueprintId: blueprint.id,
    ...(industry && industry.length > 0 ? { detectedIndustryId: industry } : {}),
    ...(order != null && order.length > 0 ? { sectionIdsOrdered: [...order] } : {}),
    primaryPage: {
      routeKey: "public_landing",
      kind: "marketing_landing",
    },
    activeRoutes: [...activeRoutes],
    routes: [...routes],
    moduleSlots: [...blueprint.defaultModuleSlots()],
  };
  return siteIrV1Schema.parse(raw);
}

export function safeParseSiteIrV1(input: unknown): SiteIrV1 | null {
  const r = siteIrV1Schema.safeParse(input);
  return r.success ? r.data : null;
}

const BOOKING_ROUTE_DESC = {
  routeKey: "public_booking" as const,
  path: "/boek",
  kind: "module_booking" as const,
};
const SHOP_ROUTE_DESC = {
  routeKey: "public_shop" as const,
  path: "/winkel",
  kind: "module_shop" as const,
};

const CANONICAL_ROUTE_ORDER: readonly SiteIrRouteKey[] = [
  "public_landing",
  "public_contact",
  "public_booking",
  "public_shop",
];

/**
 * Oude snapshots: vul `activeRoutes` + `routes` aan met vaste booking/shop-capabilities (geen regeneratie nodig).
 */
export function ensureSiteIrStandardModuleRoutes(ir: SiteIrV1): SiteIrV1 {
  const activeSet = new Set<SiteIrRouteKey>((ir.activeRoutes ?? ["public_landing"]) as SiteIrRouteKey[]);
  activeSet.add("public_booking");
  activeSet.add("public_shop");
  const activeRoutes = CANONICAL_ROUTE_ORDER.filter((k) => activeSet.has(k));

  const existing = ir.routes ?? [];
  const keys = new Set(existing.map((r) => r.routeKey));
  const routes = [...existing];
  if (!keys.has("public_booking")) {
    routes.push(BOOKING_ROUTE_DESC);
    keys.add("public_booking");
  }
  if (!keys.has("public_shop")) {
    routes.push(SHOP_ROUTE_DESC);
  }

  return siteIrV1Schema.parse({
    ...ir,
    activeRoutes,
    routes,
  });
}

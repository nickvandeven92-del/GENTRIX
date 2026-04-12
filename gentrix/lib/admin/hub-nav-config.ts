import type { BusinessOsNavItem } from "@/lib/admin/business-os-nav";
import { BUSINESS_OS_SIDEBAR_NAV } from "@/lib/admin/business-os-nav";

/** Zijbalk-item: enkel link of groep met children (Business OS / Sales-shell). */
export type NavItem =
  | { type: "item"; label: string; href: string }
  | { type: "group"; label: string; children: NavItem[] };

/** Platte weergave van BUSINESS_OS_SIDEBAR_NAV voor legacy checks. */
export const BUSINESS_OS_NAV_GROUPS_AS_NAV_ITEMS: NavItem[] = BUSINESS_OS_SIDEBAR_NAV.map((node) => {
  if (node.type === "group") {
    return {
      type: "group",
      label: node.label,
      children: node.children.map((c) => ({ type: "item" as const, label: c.label, href: c.href })),
    };
  }
  return { type: "item", label: node.label, href: node.href };
});

export type { BusinessOsNavItem };

export type HubSectionId = "dashboard" | "klanten" | "websites" | "instellingen";

/** Bepaalt welke hoofd-tab actief is (volgorde = meest specifiek eerst). */
export function getActiveHubSection(pathname: string): HubSectionId {
  const p = pathname.split("?")[0] ?? pathname;

  if (p.startsWith("/admin/editor")) return "websites";
  if (p.startsWith("/admin/ops/studio")) return "websites";
  if (p.startsWith("/admin/generator")) return "websites";
  if (p.startsWith("/admin/sites")) return "websites";
  if (p.startsWith("/admin/knowledge")) return "websites";
  if (p.startsWith("/admin/prompt")) return "websites";

  if (p.startsWith("/admin/invoices") || p.startsWith("/admin/quotes") || p.startsWith("/admin/ops")) return "dashboard";
  if (p.startsWith("/admin/clients")) return "klanten";
  if (p.startsWith("/admin/search")) return "klanten";

  if (p.startsWith("/admin/packages")) return "websites";
  if (p.startsWith("/admin/settings")) return "instellingen";

  return "dashboard";
}

/** Standaard-URL per tab (eerste klik). */
export const HUB_TAB_HREF: Record<HubSectionId, string> = {
  dashboard: "/admin/ops",
  klanten: "/admin/clients",
  websites: "/admin/ops/studio",
  instellingen: "/admin/settings",
};

export type SubNavItem = {
  href: string;
  label: string;
  description?: string;
  /** Actief als dit geldt; anders fallback: exacte match of prefix. */
  isActive?: (pathname: string) => boolean;
};

export const SUB_NAV: Record<HubSectionId, { title: string; items: SubNavItem[] }> = {
  dashboard: {
    title: "Dashboard",
    items: [
      {
        href: "/admin/ops",
        label: "Sales OS",
        description: "Commandocentrum, pijplijn, acties",
        isActive: (path) =>
          path === "/admin/ops" ||
          path === "/admin/ops/" ||
          path === "/admin" ||
          path.startsWith("/admin/ops/") ||
          path.startsWith("/admin/invoices") ||
          path.startsWith("/admin/quotes") ||
          path.startsWith("/admin/clients") ||
          path.startsWith("/admin/sites") ||
          path.startsWith("/admin/editor") ||
          path.startsWith("/admin/settings"),
      },
    ],
  },
  klanten: {
    title: "Klanten",
    items: [
      {
        href: "/admin/clients",
        label: "Alle klanten",
        description: "CRM: dossiers, commercie, domein",
        isActive: (path) =>
          path === "/admin/clients" ||
          path === "/admin/clients/" ||
          (/^\/admin\/clients\/[^/]+/.test(path) && !/\/flyer(\/|$)/.test(path)),
      },
      {
        href: "/admin/clients",
        label: "Flyer & QR",
        description: "Per klant: tab Flyer & QR in het dossier",
        isActive: (path) => /\/admin\/clients\/[^/]+\/flyer/.test(path),
      },
      {
        href: "/admin/search",
        label: "Zoeken",
        description: "Snel naar een klant of slug",
        isActive: (path) => path.startsWith("/admin/search"),
      },
    ],
  },
  websites: {
    title: "Websites",
    items: [
      {
        href: "/admin/ops/studio",
        label: "Site-studio",
        description: "AI-generator, preview, opslaan",
        isActive: (path) =>
          path.startsWith("/admin/ops/studio") || path.startsWith("/admin/generator"),
      },
      {
        href: "/admin/sites",
        label: "Alle sites",
        description: "Editor, live, WhatsApp-video",
        isActive: (path) =>
          path.startsWith("/admin/sites") || path.startsWith("/admin/editor"),
      },
      {
        href: "/admin/knowledge",
        label: "AI-kennis",
        description: "Globale instructies voor Claude",
        isActive: (path) => path.startsWith("/admin/knowledge"),
      },
      {
        href: "/admin/prompt",
        label: "Generator-referentie",
        description: "Technisch: volledige site-prompt",
        isActive: (path) => path.startsWith("/admin/prompt"),
      },
    ],
  },
  instellingen: {
    title: "Instellingen",
    items: [
      {
        href: "/admin/settings",
        label: "Algemeen",
        description: "Workspace-voorkeuren",
        isActive: (path) => path.startsWith("/admin/settings"),
      },
    ],
  },
};

function defaultSubActive(pathname: string, href: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  if (path === href) return true;
  if (href !== "/admin" && path.startsWith(`${href}/`)) return true;
  return false;
}

export function isSubNavItemActive(pathname: string, item: SubNavItem): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  if (item.isActive) return item.isActive(path);
  return defaultSubActive(path, item.href);
}

import type { LucideIcon } from "lucide-react";
import {
  Brain,
  Briefcase,
  BookOpen,
  CircleDollarSign,
  Columns3,
  Globe,
  LayoutList,
  QrCode,
  Receipt,
  ScrollText,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";

/** Blad in de zijbalk (met icoon). */
export type BusinessOsNavLeaf = {
  type: "item";
  label: string;
  href: string;
  icon: LucideIcon;
};

/** Inklapbare groep (Vercel-achtig). */
export type BusinessOsNavGroup = {
  type: "group";
  label: string;
  children: BusinessOsNavLeaf[];
};

export type BusinessOsNavItem = BusinessOsNavLeaf | BusinessOsNavGroup;

/**
 * Business OS zijbalk: commercie, financiën, klanten, operatie, instellingen.
 * Websites → bestaande route /admin/sites (geen aparte /admin/websites).
 */
export const BUSINESS_OS_SIDEBAR_NAV: BusinessOsNavItem[] = [
  {
    type: "group",
    label: "Commercie",
    children: [
      { type: "item", label: "Leads", href: "/admin/ops/leads", icon: UserPlus },
      { type: "item", label: "Deals", href: "/admin/ops/deals", icon: Briefcase },
      { type: "item", label: "Pijplijn", href: "/admin/ops/pipeline", icon: Columns3 },
    ],
  },
  {
    type: "group",
    label: "Financiën",
    children: [
      { type: "item", label: "Overzicht", href: "/admin/ops/revenue", icon: CircleDollarSign },
      { type: "item", label: "Facturen", href: "/admin/invoices", icon: Receipt },
      { type: "item", label: "Offertes", href: "/admin/quotes", icon: ScrollText },
    ],
  },
  {
    type: "group",
    label: "Klanten",
    children: [
      { type: "item", label: "Klanten", href: "/admin/clients", icon: Users },
      { type: "item", label: "Websites", href: "/admin/sites", icon: Globe },
      { type: "item", label: "Flyer & QR", href: "/admin/flyers", icon: QrCode },
    ],
  },
  {
    type: "group",
    label: "Operatie",
    children: [
      { type: "item", label: "Taken", href: "/admin/ops/tasks", icon: LayoutList },
      { type: "item", label: "Inzichten", href: "/admin/ops/insights", icon: Brain },
      { type: "item", label: "Vragen & antwoorden", href: "/admin/ops/werkwijze", icon: BookOpen },
    ],
  },
  {
    type: "group",
    label: "Instellingen",
    children: [{ type: "item", label: "Instellingen", href: "/admin/settings", icon: Settings }],
  },
];

export function businessOsNavItemIsActive(pathname: string, href: string, label?: string): boolean {
  const p = pathname.split("?")[0] ?? pathname;
  if (href === "/admin/ops") return p === "/admin/ops" || p === "/admin/ops/";
  if (href === "/admin/flyers") {
    return p === "/admin/flyers" || p === "/admin/flyers/" || /\/admin\/clients\/[^/]+\/flyer(\/|$)/.test(p);
  }
  if (href === "/admin/clients") {
    return (
      p === "/admin/clients" ||
      p === "/admin/clients/" ||
      (p.startsWith("/admin/clients/") && !/\/flyer(\/|$)/.test(p))
    );
  }
  return p === href || p.startsWith(`${href}/`);
}

export function businessOsGroupHasActive(pathname: string, group: BusinessOsNavGroup): boolean {
  return group.children.some((c) => businessOsNavItemIsActive(pathname, c.href, c.label));
}

/** Standaard open groepen: alleen degene met actieve route. */
export function businessOsDefaultOpenGroupIds(pathname: string): Set<string> {
  const open = new Set<string>();
  for (const entry of BUSINESS_OS_SIDEBAR_NAV) {
    if (entry.type === "group" && businessOsGroupHasActive(pathname, entry)) {
      open.add(entry.label);
    }
  }
  return open;
}

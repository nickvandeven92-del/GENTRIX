import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Brain,
  Building2,
  CircleDollarSign,
  Columns3,
  Gauge,
  Globe,
  LayoutList,
  MessageCircle,
  PanelTop,
  Receipt,
  ScrollText,
  Settings,
  Users,
  UserPlus,
  Briefcase,
} from "lucide-react";

export type SalesNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
};

export const SALES_NAV_MAIN: SalesNavItem[] = [
  { href: "/admin/ops", label: "Overzicht", icon: Gauge },
  { href: "/admin/ops/leads", label: "Leads", icon: UserPlus },
  { href: "/admin/ops/kvk-enrichment", label: "KVK prospecting", icon: Building2 },
  { href: "/admin/ops/deals", label: "Deals", icon: Briefcase },
  { href: "/admin/ops/clients", label: "Klanten", icon: Users },
  { href: "/admin/ops/studio", label: "Site-studio", icon: PanelTop },
  { href: "/admin/ops/websites", label: "Websites", icon: Globe },
  { href: "/admin/ops/pipeline", label: "Pijplijn", icon: Columns3 },
  { href: "/admin/ops/revenue", label: "Omzet", icon: CircleDollarSign },
  { href: "/admin/invoices", label: "Facturen", icon: Receipt },
  { href: "/admin/quotes", label: "Offertes", icon: ScrollText },
  { href: "/admin/ops/tasks", label: "Taken", icon: LayoutList },
  { href: "/admin/ops/support-inbox", label: "Support-inbox", icon: MessageCircle },
  { href: "/admin/ops/insights", label: "Inzichten", icon: Brain },
  { href: "/admin/ops/analytics", label: "Site-analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Instellingen", icon: Settings },
];

export function pageMetaForPath(pathname: string): { title: string; subtitle: string } {
  const p = pathname.split("?")[0] ?? pathname;

  if (p === "/admin/invoices/new") {
    return { title: "Nieuwe factuur", subtitle: "Regels en klant koppelen." };
  }
  if (/^\/admin\/invoices\/[^/]+\/edit$/.test(p)) {
    return { title: "Factuur bewerken", subtitle: "Regels, notities en status." };
  }
  if (/^\/admin\/invoices\/[^/]+$/.test(p)) {
    return { title: "Factuur", subtitle: "Document — afdrukken of PDF via browser." };
  }
  if (p === "/admin/quotes/new") {
    return { title: "Nieuwe offerte", subtitle: "Regels en geldigheid." };
  }
  if (/^\/admin\/quotes\/[^/]+\/edit$/.test(p)) {
    return { title: "Offerte", subtitle: "Doorverwijzing naar werkruimte." };
  }
  if (/^\/admin\/quotes\/[^/]+$/.test(p)) {
    return { title: "Offerte", subtitle: "Invullen, voorbeeld, opslaan en verzenden." };
  }

  if (pathname === "/admin/ops" || pathname === "/admin/ops/") {
    return {
      title: "Commandocentrum",
      subtitle: "Prioriteiten, pijplijn en acties — verkoop eerst.",
    };
  }
  if (pathname.startsWith("/admin/ops/studio")) {
    return {
      title: "Site-studio",
      subtitle: "AI-generatie en preview in dezelfde omgeving als je verkoop.",
    };
  }
  if (pathname.startsWith("/admin/ops/leads")) {
    return { title: "Leads", subtitle: "Kwalificeren en omzetten naar deals." };
  }
  if (pathname.startsWith("/admin/ops/kvk-enrichment")) {
    return {
      title: "KVK prospecting",
      subtitle: "Zoeken in het Handelsregister, website-detectie en sales-hoek.",
    };
  }
  if (pathname.startsWith("/admin/ops/deals")) {
    return { title: "Deals", subtitle: "Waarde, risico en volgende stap per traject." };
  }
  if (pathname.startsWith("/admin/ops/websites")) {
    return { title: "Websites", subtitle: "Levering van briefing tot live." };
  }
  if (pathname.startsWith("/admin/ops/pipeline")) {
    return { title: "Pijplijn", subtitle: "Lanes en prognose op echte deals." };
  }
  if (pathname.startsWith("/admin/ops/revenue")) {
    return { title: "Omzet", subtitle: "Pipeline, gewonnen deals en verlengingen." };
  }
  if (pathname.startsWith("/admin/invoices")) {
    return { title: "Facturen", subtitle: "Facturatie en betaalstatus." };
  }
  if (pathname.startsWith("/admin/quotes")) {
    return { title: "Offertes", subtitle: "Offertes volgen tot acceptatie." };
  }
  if (pathname.startsWith("/admin/ops/tasks")) {
    return { title: "Taken", subtitle: "Wat nu af moet." };
  }
  if (pathname.startsWith("/admin/ops/support-inbox")) {
    return {
      title: "Support-inbox",
      subtitle: "Klantvragen uit het portaal — wachtend op antwoord.",
    };
  }
  if (pathname.startsWith("/admin/ops/insights")) {
    return { title: "Inzichten", subtitle: "Feiten uit de database — geen gegenereerde praatjes." };
  }
  if (pathname.startsWith("/admin/ops/analytics")) {
    return {
      title: "Site-analytics",
      subtitle: "Eerstepartij /site meetdata — page views, CTA’s, scroll, engagement.",
    };
  }
  if (pathname.startsWith("/admin/ops/clients")) {
    return { title: "Klanten", subtitle: "Gezondheid, betalingen en koppelingen." };
  }
  return { title: "Sales OS", subtitle: "Verkoopplatform." };
}

"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { SalesOsShell } from "@/components/sales-os/sales-os-shell";

type AdminChromeProps = {
  children: ReactNode;
};

/**
 * Kiest chrome: Sales OS (/admin/ops/*) vs bestaande admin hub.
 * AI-engine en API-routes blijven ongewijzigd; alleen UI-shell.
 */
export function AdminChrome({ children }: AdminChromeProps) {
  const pathname = usePathname() ?? "";
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/ops") ||
    pathname.startsWith("/admin/invoices") ||
    pathname.startsWith("/admin/quotes") ||
    pathname.startsWith("/admin/clients") ||
    pathname.startsWith("/admin/flyers") ||
    pathname.startsWith("/admin/sites") ||
    pathname.startsWith("/admin/editor") ||
    pathname.startsWith("/admin/settings")
  ) {
    return <SalesOsShell>{children}</SalesOsShell>;
  }
  return <AdminShell>{children}</AdminShell>;
}

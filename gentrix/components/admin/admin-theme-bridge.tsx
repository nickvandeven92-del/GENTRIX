"use client";

import { useEffect } from "react";
import {
  ADMIN_DASHBOARD_THEME_STORAGE_KEY,
  applyAdminDashboardThemeToDocument,
  clearAdminDashboardThemeFromDocument,
} from "@/lib/admin/dashboard-theme";

/** Zet dashboard-thema op <html> bij binnenkomst admin; ruimt op bij verlaten. */
export function AdminThemeBridge() {
  useEffect(() => {
    applyAdminDashboardThemeToDocument();
    try {
      localStorage.setItem(ADMIN_DASHBOARD_THEME_STORAGE_KEY, "light");
    } catch {
      /* ignore */
    }
    return () => clearAdminDashboardThemeFromDocument();
  }, []);

  return null;
}

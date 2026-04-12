export const ADMIN_DASHBOARD_THEME_STORAGE_KEY = "admin-dashboard-theme";

/** Alleen nog het lichte dashboard; oude waarden dark/glass worden genegeerd. */
export type AdminDashboardTheme = "light";

export const ADMIN_DASHBOARD_THEME_DEFAULT: AdminDashboardTheme = "light";

const THEME_CLASSES = ["admin-theme-light", "admin-theme-dark", "admin-theme-glass"] as const;

export function normalizeAdminDashboardTheme(value: string | null): AdminDashboardTheme {
  void value;
  return ADMIN_DASHBOARD_THEME_DEFAULT;
}

/** Zet altijd licht admin-thema op <html>; geen `dark`-class. */
export function applyAdminDashboardThemeToDocument(theme?: AdminDashboardTheme): void {
  void theme;
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES, "dark");
  root.classList.add("admin-theme-light");
}

export function clearAdminDashboardThemeFromDocument(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES, "dark");
}

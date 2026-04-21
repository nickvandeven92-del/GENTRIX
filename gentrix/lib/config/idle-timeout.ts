/**
 * Centrale inactivity-timeout voor CRM / Sales OS.
 * Pas deze waarden aan als de auto-logout-ervaring voor de backoffice moet veranderen.
 */
export const SALES_OS_IDLE_LOGOUT_MINUTES = 10;
export const SALES_OS_IDLE_WARNING_LEAD_MINUTES = 1;

export const SALES_OS_IDLE_WARNING_MS =
  (SALES_OS_IDLE_LOGOUT_MINUTES - SALES_OS_IDLE_WARNING_LEAD_MINUTES) * 60 * 1_000;

export const SALES_OS_IDLE_LOGOUT_MS = SALES_OS_IDLE_LOGOUT_MINUTES * 60 * 1_000;

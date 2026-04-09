/** PostgREST / Supabase when table or view is not in schema (migration not applied). */
export function isSupabaseMissingRelationError(message: string): boolean {
  return /Could not find the table|Could not find the.*relation|does not exist|schema cache/i.test(message);
}

export const SALES_OS_CORE_MIGRATION = "supabase/migrations/20260410120000_sales_os_core.sql";

let salesOsSchemaWarningShown = false;

/**
 * Logs Supabase read errors. Missing-relation → warn (not error). For Sales OS tables, only one
 * consolidated warning per dev server run to avoid four identical messages on /admin/ops.
 */
export function logSupabaseReadError(
  label: string,
  message: string,
  options?: { salesOsMigrationHint?: boolean },
): void {
  if (!isSupabaseMissingRelationError(message)) {
    console.error(`[${label}]`, message);
    return;
  }
  if (options?.salesOsMigrationHint) {
    if (!salesOsSchemaWarningShown) {
      salesOsSchemaWarningShown = true;
      console.warn(
        "[Sales OS] Supabase mist tabellen uit de Sales OS-migratie (o.a. sales_leads, sales_deals, sales_tasks, website_ops_state). " +
          `Voer eenmalig uit: bestand ${SALES_OS_CORE_MIGRATION} in het Supabase Dashboard → SQL, of \`npx supabase link --project-ref …\` en daarna \`npx supabase db push\`.`,
      );
    }
    return;
  }
  console.warn(`[${label}] ${message}`);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdministrativeYear } from "@/lib/commercial/administrative-calendar";

/**
 * Centrale documentnummering (v1).
 * Twee parallelle aanvragen kunnen tijdelijk hetzelfde voorstel doen; de database unique index weigert dan de tweede insert/update.
 * Bij hoge concurrentie: opnieuw proberen met een verse max-read, of later een counter-tabel.
 *
 * Het jaardeel voor CL/OFF/INV volgt altijd {@link getAdministrativeYear} (Europe/Amsterdam), niet server-local time.
 */

const SEQ_WIDTH = 3;

export type DocumentNumberPrefix = "CL" | "OFF" | "INV";

function padSeq(n: number): string {
  return String(n).padStart(SEQ_WIDTH, "0");
}

function seqRegex(prefix: DocumentNumberPrefix, year: number): RegExp {
  return new RegExp(`^${prefix}-${year}-(\\d+)$`);
}

export function parseDocumentSequence(num: string, prefix: DocumentNumberPrefix, year: number): number | null {
  const m = num.trim().match(seqRegex(prefix, year));
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

async function maxSequenceForYear(
  supabase: SupabaseClient,
  table: "clients" | "quotes" | "invoices",
  column: string,
  prefix: DocumentNumberPrefix,
  year: number,
): Promise<number> {
  const pattern = `${prefix}-${year}-%`;
  let q = supabase.from(table).select(column).like(column, pattern);
  if (table === "invoices") {
    q = q.not(column, "is", null);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const re = seqRegex(prefix, year);
  let max = 0;
  for (const row of data ?? []) {
    const raw = (row as unknown as Record<string, string | null>)[column];
    if (raw == null || String(raw).length === 0) continue;
    const m = String(raw).match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

async function proposeNextNumber(
  supabase: SupabaseClient,
  table: "clients" | "quotes" | "invoices",
  column: string,
  prefix: DocumentNumberPrefix,
  year: number,
): Promise<string> {
  const max = await maxSequenceForYear(supabase, table, column, prefix, year);
  return `${prefix}-${year}-${padSeq(max + 1)}`;
}

/** Volgende klantnummer CL-YYYY-NNN (administratief jaar Amsterdam tenzij `year` gezet). */
export async function generateClientNumber(
  supabase: SupabaseClient,
  year: number = getAdministrativeYear(),
): Promise<string> {
  return proposeNextNumber(supabase, "clients", "client_number", "CL", year);
}

/** Volgende offertenummer OFF-YYYY-NNN. */
export async function generateQuoteNumber(
  supabase: SupabaseClient,
  year: number = getAdministrativeYear(),
): Promise<string> {
  return proposeNextNumber(supabase, "quotes", "quote_number", "OFF", year);
}

/**
 * Volgende factuurnummer INV-YYYY-NNN.
 * Alleen aanroepen bij definitieve toekenning (status verstuurd/betaald).
 */
export async function generateInvoiceNumber(
  supabase: SupabaseClient,
  year: number = getAdministrativeYear(),
): Promise<string> {
  return proposeNextNumber(supabase, "invoices", "invoice_number", "INV", year);
}

export function isPostgresUniqueViolationMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("duplicate key") || m.includes("unique constraint") || m.includes("23505");
}

export type AssignDefinitiveInvoiceNumberResult = {
  invoiceNumber: string;
  /** True alleen als deze aanroep de UPDATE heeft gedaan (geen bestaand nummer op de rij). */
  assigned: boolean;
};

/**
 * Factuurnummer toekennen met korte retry bij unieke-conflict (parallelle verzoeken).
 */
export async function assignDefinitiveInvoiceNumber(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<AssignDefinitiveInvoiceNumberResult> {
  for (let a = 0; a < 8; a++) {
    const { data: cur } = await supabase.from("invoices").select("invoice_number").eq("id", invoiceId).maybeSingle();
    if (cur?.invoice_number) {
      return { invoiceNumber: cur.invoice_number as string, assigned: false };
    }

    const candidate = await generateInvoiceNumber(supabase);
    const { error } = await supabase
      .from("invoices")
      .update({ invoice_number: candidate })
      .eq("id", invoiceId)
      .is("invoice_number", null);

    if (!error) return { invoiceNumber: candidate, assigned: true };
    if (isPostgresUniqueViolationMessage(error.message)) continue;
    throw new Error(error.message);
  }
  throw new Error("Factuurnummer toekennen mislukt na meerdere pogingen.");
}

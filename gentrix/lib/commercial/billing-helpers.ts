export type InvoiceStoredStatus = "draft" | "sent" | "paid" | "cancelled";

/** Statussen die de klant in het portaal ziet (geen concepten). */
export const PORTAL_VISIBLE_INVOICE_STATUSES: InvoiceStoredStatus[] = ["sent", "paid", "cancelled"];

export function isInvoiceStatusVisibleInPortal(status: InvoiceStoredStatus): boolean {
  return PORTAL_VISIBLE_INVOICE_STATUSES.includes(status);
}

/** @deprecated Gebruik InvoiceStoredStatus */
export type InvoiceStatus = InvoiceStoredStatus;

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

export type InvoiceRowLike = {
  status: InvoiceStoredStatus;
  due_date: string;
  paid_at?: string | null;
};

export type LineItemLike = {
  quantity: string | number;
  unit_price: string | number;
  line_total?: string | number;
};

const INVOICE_LABELS: Record<InvoiceStoredStatus, string> = {
  draft: "Concept",
  sent: "Verzonden",
  paid: "Betaald",
  cancelled: "Geannuleerd",
};

const QUOTE_LABELS: Record<QuoteStatus, string> = {
  draft: "Concept",
  sent: "Verzonden",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
};

/** Alleen opgeslagen status (geen “Achterstallig”). */
export function getInvoiceStatusLabel(status: InvoiceStoredStatus): string {
  return INVOICE_LABELS[status];
}

/** Lijst/UX: achterstallig afgeleid uit vervaldatum. */
export function getInvoiceListStatusLabel(invoice: InvoiceRowLike): string {
  if (isInvoiceOverdue(invoice)) return "Achterstallig";
  return getInvoiceStatusLabel(invoice.status);
}

export function getQuoteStatusLabel(status: QuoteStatus): string {
  return QUOTE_LABELS[status];
}

/** @deprecated Gebruik getInvoiceStatusLabel / getInvoiceListStatusLabel */
export const INVOICE_STATUS_LABELS = INVOICE_LABELS;

/** @deprecated Gebruik getQuoteStatusLabel */
export const QUOTE_STATUS_LABELS = QUOTE_LABELS;

export function parseInvoiceAmount(amount: string | number): number {
  if (typeof amount === "number") return Number.isFinite(amount) ? amount : 0;
  const n = parseFloat(amount);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrencyEUR(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDocumentDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDocumentDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Kalenderdag in lokale tijd (YYYY-MM-DD). */
export function todayLocalISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isInvoiceOverdue(invoice: InvoiceRowLike): boolean {
  if (invoice.status === "paid" || invoice.status === "cancelled") return false;
  return invoice.due_date < todayLocalISODate();
}

export function calculateInvoiceTotal(items: LineItemLike[]): number {
  return items.reduce((sum, row) => {
    if (row.line_total !== undefined) return sum + parseInvoiceAmount(row.line_total);
    return sum + parseInvoiceAmount(row.quantity) * parseInvoiceAmount(row.unit_price);
  }, 0);
}

export function calculateQuoteTotal(items: LineItemLike[]): number {
  return calculateInvoiceTotal(items);
}

export function groupInvoicesByStatus<T extends { status: InvoiceStoredStatus }>(
  invoices: T[],
): Record<InvoiceStoredStatus, T[]> {
  const empty: Record<InvoiceStoredStatus, T[]> = {
    draft: [],
    sent: [],
    paid: [],
    cancelled: [],
  };
  for (const inv of invoices) {
    empty[inv.status].push(inv);
  }
  return empty;
}

/** Regelbedrag afronden op 2 decimalen. */
export function lineTotalFromQtyPrice(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

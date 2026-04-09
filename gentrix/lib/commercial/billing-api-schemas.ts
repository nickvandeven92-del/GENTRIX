import { z } from "zod";

/** Alle opgeslagen factuurstatussen (DB + machine). */
const invoiceStoredStatuses = z.enum(["draft", "sent", "paid", "cancelled"]);
/** Aanmaak via API: geen directe “geannuleerd”-aanmaak. */
const createInvoiceStatuses = z.enum(["draft", "sent", "paid"]);
const quoteStatuses = z.enum(["draft", "sent", "accepted", "rejected"]);

export const lineItemInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative(),
});

const nullableLongText = z.union([z.string().max(50000), z.null()]).optional();

export const createInvoiceBodySchema = z
  .object({
    client_id: z.string().uuid(),
    deal_id: z.string().uuid().nullish(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: createInvoiceStatuses.optional().default("draft"),
    notes: z.string().nullable().optional(),
    items: z.array(lineItemInputSchema).min(1),
    /** ISO-datetime of alleen datum; leeg = nu */
    issued_at: z.string().nullable().optional(),
  })
  .strict();

export const patchInvoiceBodySchema = z
  .object({
    status: invoiceStoredStatuses.optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().nullable().optional(),
    paid_at: z.string().nullable().optional(),
    issued_at: z.string().nullable().optional(),
    sent_at: z.string().nullable().optional(),
    replace_items: z.array(lineItemInputSchema).min(1).optional(),
    /** Verplicht bij riskante transities (concept→betaald, verzonden→concept, betaald→geannuleerd). */
    confirm_exception_transition: z.boolean().optional(),
  })
  .strict();

export const createQuoteBodySchema = z.object({
  client_id: z.string().uuid(),
  deal_id: z.string().uuid().nullish(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: quoteStatuses.optional().default("draft"),
  notes: z.string().nullable().optional(),
  items: z.array(lineItemInputSchema).min(1),
  title: z.string().max(500).nullable().optional(),
  intro_text: nullableLongText,
  scope_text: nullableLongText,
  delivery_text: nullableLongText,
  exclusions_text: nullableLongText,
  terms_text: nullableLongText,
  issued_at: z.string().nullable().optional(),
});

const snapshotShort = z.union([z.string().max(500), z.null()]).optional();
const snapshotMedium = z.union([z.string().max(2000), z.null()]).optional();

export const patchQuoteBodySchema = z.object({
  status: quoteStatuses.optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().nullable().optional(),
  replace_items: z.array(lineItemInputSchema).min(1).optional(),
  title: z.string().max(500).nullable().optional(),
  intro_text: nullableLongText,
  scope_text: nullableLongText,
  delivery_text: nullableLongText,
  exclusions_text: nullableLongText,
  terms_text: nullableLongText,
  issued_at: z.string().nullable().optional(),
  /** Snapshot op het document; los van live klantgegevens. */
  company_name_snapshot: snapshotShort,
  contact_name_snapshot: snapshotMedium,
  billing_email_snapshot: z.union([z.string().max(320), z.null()]).optional(),
  billing_phone_snapshot: z.union([z.string().max(80), z.null()]).optional(),
  billing_address_snapshot: snapshotMedium,
  billing_postal_code_snapshot: z.union([z.string().max(32), z.null()]).optional(),
  billing_city_snapshot: z.union([z.string().max(120), z.null()]).optional(),
});

export type PatchInvoiceBody = z.infer<typeof patchInvoiceBodySchema>;
export type CreateInvoiceBody = z.infer<typeof createInvoiceBodySchema>;

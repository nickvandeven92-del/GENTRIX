import { lineTotalFromQtyPrice } from "@/lib/commercial/billing-helpers";

export type LineItemInput = { description: string; quantity: number; unit_price: number };

export type ClientRowForSnapshot = {
  name: string;
  company_legal_name: string | null;
  contact_name: string | null;
  billing_email: string | null;
  phone: string | null;
  billing_address: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
};

export function mapLineInputsToRows(
  items: LineItemInput[],
): { description: string; quantity: number; unit_price: number; line_total: number; position: number }[] {
  return items.map((it, position) => {
    const quantity = it.quantity;
    const unit_price = it.unit_price;
    return {
      description: it.description,
      quantity,
      unit_price,
      line_total: lineTotalFromQtyPrice(quantity, unit_price),
      position,
    };
  });
}

export function totalFromLineRows(rows: { line_total: number }[]): number {
  return Math.round(rows.reduce((s, r) => s + r.line_total, 0) * 100) / 100;
}

/** Vaste snapshot-kolommen voor factuur/offerte (document toont dit, geen live klantdata). */
export function clientSnapshotsFromRow(c: ClientRowForSnapshot) {
  const legal = c.company_legal_name?.trim();
  return {
    company_name_snapshot: legal && legal.length > 0 ? legal : c.name,
    contact_name_snapshot: c.contact_name?.trim() || null,
    billing_email_snapshot: c.billing_email?.trim() || null,
    billing_phone_snapshot: c.phone?.trim() || null,
    billing_address_snapshot: c.billing_address?.trim() || null,
    billing_postal_code_snapshot: c.billing_postal_code?.trim() || null,
    billing_city_snapshot: c.billing_city?.trim() || null,
  };
}

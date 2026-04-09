import { NextResponse } from "next/server";

export type BillingErrorBody = {
  ok: false;
  error: string;
  code: string;
  reasonCode?: string;
  /** Machine-leesbare severity (statusmachine / validatie). */
  severity?: "info" | "warning" | "error";
};

export function billingErrorResponse(
  status: number,
  code: string,
  message: string,
  extras?: Partial<Pick<BillingErrorBody, "reasonCode" | "severity">>,
): NextResponse {
  const body: BillingErrorBody = {
    ok: false,
    error: message,
    code,
    ...extras,
  };
  return NextResponse.json(body, { status });
}

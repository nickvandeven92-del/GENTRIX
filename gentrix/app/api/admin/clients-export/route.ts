import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { listAdminClients } from "@/lib/data/list-admin-clients";

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const rows = await listAdminClients();
  const headers = [
    "klantnummer",
    "name",
    "subfolder_slug",
    "status",
    "generation_package",
    "plan_type",
    "plan_label",
    "payment_status",
    "pipeline_stage",
    "billing_email",
    "custom_domain",
    "updated_at",
  ] as const;

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        csvEscape(r.client_number ?? ""),
        csvEscape(r.name),
        csvEscape(r.subfolder_slug),
        csvEscape(r.status),
        csvEscape(r.generation_package ?? ""),
        csvEscape(r.plan_type ?? ""),
        csvEscape(r.plan_label ?? ""),
        csvEscape(r.payment_status),
        csvEscape(r.pipeline_stage),
        csvEscape(r.billing_email ?? ""),
        csvEscape(r.custom_domain ?? ""),
        csvEscape(r.updated_at),
      ].join(","),
    ),
  ];

  const body = lines.join("\r\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="klanten-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

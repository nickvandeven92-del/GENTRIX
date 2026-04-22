import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPublicRateLimit } from "@/lib/api/public-rate-limit";
import { extractClientIp } from "@/lib/api/request-client-ip";
import { isValidIban, normalizeIban } from "@/lib/banking/iban";
import { notifyStudioOfSiteOrder } from "@/lib/email/studio-site-order-notification";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { decodeRouteSlugParam } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Vereist voor concept-site (`?token=`). */
  token: z.string().max(500).optional().or(z.literal("")),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(6).max(40),
  postalCode: z
    .string()
    .trim()
    .max(12)
    .transform((s) => s.replace(/\s+/g, "").toUpperCase()),
  houseNumber: z.string().trim().min(1).max(12),
  houseSuffix: z.string().trim().max(24).optional().or(z.literal("")),
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(120),
  iban: z.string().trim().min(8).max(42),
  accountHolder: z.string().trim().min(2).max(200),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  /** Geselecteerde add-on modules (bijv. ["booking", "webshop"]). */
  selectedModules: z.array(z.string().max(40)).max(10).optional().default([]),
  /** Akkoord algemene voorwaarden + privacy. */
  acceptTerms: z.literal(true),
  /** SEPA-incassomachtiging gegeven. */
  acceptSepa: z.literal(true),
  /** Afstand herroepingsrecht: dienst start direct. */
  acceptWithdrawal: z.literal(true),
});

type RouteCtx = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteCtx) {
  const { slug: raw } = await context.params;
  const slug = decodeRouteSlugParam(raw);
  if (!slug) {
    return NextResponse.json({ ok: false as const, error: "Ongeldige site." }, { status: 400 });
  }

  const ip = extractClientIp(request.headers);
  if (!checkPublicRateLimit(ip, `site-order:${slug}`, 5)) {
    return NextResponse.json(
      { ok: false as const, error: "Te veel pogingen. Probeer over een paar minuten opnieuw." },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Controleer de invoer.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const bundle = await getPublishedSiteBySlug(slug, token);
  if (!bundle) {
    return NextResponse.json({ ok: false as const, error: "Site niet gevonden of geen toegang." }, { status: 404 });
  }

  const iban = normalizeIban(body.iban);
  if (!isValidIban(iban)) {
    return NextResponse.json({ ok: false as const, error: "Ongeldig IBAN." }, { status: 400 });
  }

  const postalNorm = body.postalCode;
  if (!/^[1-9][0-9]{3}[A-Z]{2}$/.test(postalNorm)) {
    return NextResponse.json({ ok: false as const, error: "Ongeldige postcode." }, { status: 400 });
  }

  const isConceptPreview = Boolean(bundle.isConceptTokenAccess);
  const payloadJson = {
    firstName: body.firstName,
    lastName: body.lastName,
    companyName: body.companyName || null,
    email: body.email,
    phone: body.phone,
    postalCode: postalNorm,
    houseNumber: body.houseNumber,
    houseSuffix: body.houseSuffix || null,
    street: body.street,
    city: body.city,
    iban,
    accountHolder: body.accountHolder,
    notes: body.notes || null,
    selectedModules: body.selectedModules ?? [],
    consentVersion: "v1",
    acceptSepa: true,
    acceptWithdrawal: true,
    submittedAt: new Date().toISOString(),
  };

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("studio_site_orders").insert({
    client_subfolder_slug: slug,
    is_concept_preview: isConceptPreview,
    customer_email: body.email,
    payload_json: payloadJson,
  });

  if (error) {
    const msg = error.message?.includes("studio_site_orders") ? "Database nog niet bijgewerkt (migratie)." : error.message;
    return NextResponse.json({ ok: false as const, error: msg }, { status: 503 });
  }

  await notifyStudioOfSiteOrder({
    clientSubfolderSlug: slug,
    isConceptPreview,
    firstName: body.firstName,
    lastName: body.lastName,
    companyName: body.companyName || undefined,
    email: body.email,
    phone: body.phone,
    postalCode: postalNorm,
    houseNumber: body.houseNumber,
    houseSuffix: body.houseSuffix || undefined,
    street: body.street,
    city: body.city,
    iban,
    accountHolder: body.accountHolder,
    notes: body.notes || undefined,
  });

  return NextResponse.json({ ok: true as const });
}

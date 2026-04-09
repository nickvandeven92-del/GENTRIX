import type { InvoiceStoredStatus } from "@/lib/commercial/billing-helpers";

export type TransitionSeverity = "info" | "warning" | "error";

export type InvoiceStatusTransitionResult = {
  allowed: boolean;
  reasonCode: string;
  severity: TransitionSeverity;
  requiresAuditLog: boolean;
  /** UI/API: extra bevestiging nodig (gevaarlijke correctie of snelkoppeling). */
  requiresConfirmation: boolean;
  /** Nederlandse tekst voor API/UI */
  userMessage: string;
};

const ALL: InvoiceStoredStatus[] = ["draft", "sent", "paid", "cancelled"];

function isKnown(s: string): s is InvoiceStoredStatus {
  return (ALL as string[]).includes(s);
}

export type InvoiceStatusTransitionContext = {
  /** Expliciete bevestiging van client (riskante actie). */
  confirmed?: boolean;
};

/**
 * Centrale statusmachine facturen. Gebruik in elke route die status wijzigt.
 *
 * Normaal: draft→sent, sent→paid.
 * Uitzonderingen: draft→paid, sent→draft, *→cancelled (met regels).
 * Geblokkeerd: paid→draft/sent, cancelled→*, en onbekende statussen.
 */
/** UI: moet de gebruiker expliciet bevestigen vóór PATCH? */
export function invoiceTransitionRequiresConfirmation(from: string, to: string): boolean {
  if (from === to) return false;
  const r = validateInvoiceStatusTransition(from, to, { confirmed: false });
  return !r.allowed && r.requiresConfirmation;
}

export function validateInvoiceStatusTransition(
  from: string,
  to: string,
  context?: InvoiceStatusTransitionContext,
): InvoiceStatusTransitionResult {
  if (from === to) {
    return {
      allowed: true,
      reasonCode: "NOOP_SAME_STATUS",
      severity: "info",
      requiresAuditLog: false,
      requiresConfirmation: false,
      userMessage: "Status ongewijzigd.",
    };
  }

  if (!isKnown(from) || !isKnown(to)) {
    return {
      allowed: false,
      reasonCode: "UNKNOWN_STATUS",
      severity: "error",
      requiresAuditLog: true,
      requiresConfirmation: false,
      userMessage: "Onbekende factuurstatus.",
    };
  }

  const confirmed = Boolean(context?.confirmed);

  // Vanaf geannuleerd: geen heropening via deze machine (nieuwe factuur aanmaken).
  if (from === "cancelled") {
    return {
      allowed: false,
      reasonCode: "FROM_CANCELLED_BLOCKED",
      severity: "error",
      requiresAuditLog: true,
      requiresConfirmation: false,
      userMessage: "Een geannuleerde factuur kan niet opnieuw worden geactiveerd. Maak indien nodig een nieuwe factuur.",
    };
  }

  // Betaald terugdraaien: niet toegestaan (boekhoudkundige integriteit).
  if (from === "paid" && (to === "draft" || to === "sent")) {
    return {
      allowed: false,
      reasonCode: "PAID_DOWNGRADE_BLOCKED",
      severity: "error",
      requiresAuditLog: true,
      requiresConfirmation: false,
      userMessage: "Een betaalde factuur kan niet terug naar concept of verzonden. Neem contact op met beheer bij een echte correctie.",
    };
  }

  // Standaardpaden
  if (from === "draft" && to === "sent") {
    return {
      allowed: true,
      reasonCode: "DRAFT_TO_SENT",
      severity: "info",
      requiresAuditLog: true,
      requiresConfirmation: false,
      userMessage: "Factuur wordt verzonden; er wordt een definitief factuurnummer toegekend.",
    };
  }

  if (from === "sent" && to === "paid") {
    return {
      allowed: true,
      reasonCode: "SENT_TO_PAID",
      severity: "info",
      requiresAuditLog: true,
      requiresConfirmation: false,
      userMessage: "Factuur gemarkeerd als betaald.",
    };
  }

  // Snelkoppeling concept → betaald
  if (from === "draft" && to === "paid") {
    if (!confirmed) {
      return {
        allowed: false,
        reasonCode: "DRAFT_TO_PAID_NEEDS_CONFIRMATION",
        severity: "warning",
        requiresAuditLog: false,
        requiresConfirmation: true,
        userMessage:
          "Direct van concept naar betaald is een uitzondering. Bevestig deze actie expliciet (bevestigingsvlag in de aanvraag).",
      };
    }
    return {
      allowed: true,
      reasonCode: "DRAFT_TO_PAID_EXCEPTION",
      severity: "warning",
      requiresAuditLog: true,
      requiresConfirmation: false,
      userMessage: "Factuur direct op betaald gezet; definitief nummer wordt toegekend.",
    };
  }

  // Verzonden terug naar concept (admin-correctie)
  if (from === "sent" && to === "draft") {
    if (!confirmed) {
      return {
        allowed: false,
        reasonCode: "SENT_TO_DRAFT_NEEDS_CONFIRMATION",
        severity: "warning",
        requiresAuditLog: false,
        requiresConfirmation: true,
        userMessage:
          "Terugzetten naar concept wist de verzenddatum en is bedoeld voor correcties. Bevestig deze actie expliciet.",
      };
    }
    return {
      allowed: true,
      reasonCode: "SENT_TO_DRAFT_EXCEPTION",
      severity: "warning",
      requiresAuditLog: true,
      requiresConfirmation: false,
      userMessage: "Factuur teruggezet naar concept. Bestaand factuurnummer blijft staan.",
    };
  }

  // Annuleren
  if (to === "cancelled") {
    if (from === "paid") {
      if (!confirmed) {
        return {
          allowed: false,
          reasonCode: "PAID_TO_CANCELLED_NEEDS_CONFIRMATION",
          severity: "warning",
          requiresAuditLog: false,
          requiresConfirmation: true,
          userMessage: "Een betaalde factuur annuleren is uitzonderlijk. Bevestig deze actie expliciet.",
        };
      }
      return {
        allowed: true,
        reasonCode: "PAID_TO_CANCELLED_EXCEPTION",
        severity: "warning",
        requiresAuditLog: true,
        requiresConfirmation: false,
        userMessage: "Factuur geannuleerd (na betaling).",
      };
    }
    if (from === "draft" || from === "sent") {
      return {
        allowed: true,
        reasonCode: `${from.toUpperCase()}_TO_CANCELLED`,
        severity: "info",
        requiresAuditLog: true,
        requiresConfirmation: false,
        userMessage: "Factuur geannuleerd.",
      };
    }
  }

  // paid → cancelled handled; paid → anything else blocked above

  return {
    allowed: false,
    reasonCode: "TRANSITION_NOT_ALLOWED",
    severity: "error",
    requiresAuditLog: true,
    requiresConfirmation: false,
    userMessage: `Overgang van “${from}” naar “${to}” is niet toegestaan.`,
  };
}

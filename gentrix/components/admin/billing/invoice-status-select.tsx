"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { InvoiceStoredStatus } from "@/lib/commercial/billing-helpers";
import { getInvoiceStatusLabel } from "@/lib/commercial/billing-helpers";
import {
  invoiceTransitionRequiresConfirmation,
  validateInvoiceStatusTransition,
} from "@/lib/commercial/invoice-status-machine";

const STATUSES: InvoiceStoredStatus[] = ["draft", "sent", "paid", "cancelled"];

export function InvoiceStatusSelect({
  invoiceId,
  initialStatus,
}: {
  invoiceId: string;
  initialStatus: InvoiceStoredStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(initialStatus);
  }, [initialStatus]);

  async function patchStatus(next: InvoiceStoredStatus, confirmException: boolean) {
    const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-audit-source": "admin_ui",
      },
      body: JSON.stringify({
        status: next,
        ...(confirmException ? { confirm_exception_transition: true } : {}),
      }),
    });
    const j = (await res.json()) as {
      ok?: boolean;
      error?: string;
      code?: string;
      reasonCode?: string;
    };
    return j;
  }

  async function onChange(next: InvoiceStoredStatus) {
    if (next === value) return;
    if (initialStatus === "cancelled") {
      alert("Een geannuleerde factuur kan niet opnieuw worden geactiveerd.");
      setValue(initialStatus);
      return;
    }

    const unchecked = validateInvoiceStatusTransition(initialStatus, next, { confirmed: false });
    if (!unchecked.allowed && !unchecked.requiresConfirmation) {
      alert(unchecked.userMessage);
      setValue(initialStatus);
      return;
    }

    let confirmException = false;
    if (invoiceTransitionRequiresConfirmation(initialStatus, next)) {
      if (!window.confirm(unchecked.userMessage)) {
        setValue(initialStatus);
        return;
      }
      confirmException = true;
    }

    setBusy(true);
    setValue(next);
    try {
      let j = await patchStatus(next, confirmException);
      if (!j.ok && j.code === "CONFIRMATION_REQUIRED") {
        if (window.confirm(j.error ?? "Bevestig deze uitzonderlijke statuswijziging.")) {
          j = await patchStatus(next, true);
        } else {
          setValue(initialStatus);
          return;
        }
      }
      if (!j.ok) {
        setValue(initialStatus);
        alert(j.error ?? "Bijwerken mislukt.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      disabled={busy || initialStatus === "cancelled"}
      value={value}
      onChange={(e) => void onChange(e.target.value as InvoiceStoredStatus)}
      className="max-w-[11rem] rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-900 disabled:opacity-60"
      aria-label="Factuurstatus wijzigen"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {getInvoiceStatusLabel(s)}
        </option>
      ))}
    </select>
  );
}

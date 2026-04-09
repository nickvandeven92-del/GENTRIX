/**
 * Transactionele e-mail via Resend REST API (geen extra npm-pakket).
 * Zonder RESEND_API_KEY: no-op (geen fout naar de gebruiker).
 *
 * @see https://resend.com/docs/api-reference/emails/send-email
 */

export type ResendAttachment = {
  filename: string;
  /** Base64-encoded file body */
  content: string;
};

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: ResendAttachment[];
};

export type SendTransactionalEmailResult =
  | { ok: true; skipped?: boolean; id?: string }
  | { ok: false; error: string };

function defaultFrom(): string {
  const f = process.env.RESEND_FROM?.trim();
  if (f) return f;
  return "GENTRIX <onboarding@resend.dev>";
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<SendTransactionalEmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info("[email] RESEND_API_KEY ontbreekt — e-mail overgeslagen.");
    }
    return { ok: true, skipped: true };
  }

  const to = input.to.trim();
  if (!to) {
    return { ok: false, error: "Geen ontvanger." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: defaultFrom(),
        to: [to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments?.length ? input.attachments : undefined,
      }),
    });

    const json = (await res.json()) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      const msg = json.message ?? json.name ?? res.statusText;
      return { ok: false, error: msg };
    }
    return { ok: true, id: json.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Netwerkfout";
    return { ok: false, error: message };
  }
}

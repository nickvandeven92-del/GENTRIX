"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, KeyRound, LayoutDashboard } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { clearAgendaPinUnlock } from "@/components/agenda/agenda-pin-gate";
import { PortalAppointmentNotifier } from "@/components/portal/portal-appointment-notifier";

type AgendaShellProps = {
  slug: string;
  clientName: string;
  clientId: string;
  publicBookingHref: string;
  appointmentsEnabled: boolean;
  children: React.ReactNode;
};

export function AgendaShell({
  slug,
  clientName,
  clientId,
  publicBookingHref,
  appointmentsEnabled,
  children,
}: AgendaShellProps) {
  const enc = encodeURIComponent(decodeURIComponent(slug));
  const portalBase = `/portal/${enc}`;
  const agendaPath = `/agenda/${enc}`;
  const [pinOpen, setPinOpen] = useState(false);
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  async function savePin(clear: boolean) {
    setPinMsg(null);
    setPinBusy(true);
    try {
      const body = clear ? { pin: null } : { pin: pinNew };
      if (!clear) {
        if (pinNew.length < 4 || pinNew.length > 6 || pinNew !== pinConfirm) {
          setPinMsg("PIN moet 4–6 cijfers zijn en tweemaal hetzelfde.");
          setPinBusy(false);
          return;
        }
      }
      const res = await fetch(`/api/portal/clients/${enc}/agenda-pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setPinMsg(json.error ?? "Opslaan mislukt.");
        return;
      }
      clearAgendaPinUnlock(clientId);
      setPinNew("");
      setPinConfirm("");
      setPinOpen(false);
      setPinMsg(clear ? "PIN verwijderd." : "PIN opgeslagen. Op dit apparaat opnieuw invoeren.");
    } catch {
      setPinMsg("Netwerkfout.");
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-emerald-900/20 bg-emerald-950 text-emerald-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">Agenda &amp; boekingen</p>
            <p className="truncate text-sm font-semibold text-white">{clientName}</p>
            <p className="mt-0.5 text-xs text-emerald-200/80">
              Zelfde inlog als het Gentrix-portaal — geen apart wachtwoord. Facturen en studio-zaken staan in het
              portaal.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href={portalBase}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/80 bg-emerald-900/40 px-3 py-2 text-sm text-white hover:bg-emerald-900/70"
            >
              <LayoutDashboard className="size-4 shrink-0" aria-hidden />
              Gentrix-portaal
            </Link>
            <a
              href={publicBookingHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/80 px-3 py-2 text-sm text-white hover:bg-emerald-900/40"
            >
              <ExternalLink className="size-4 shrink-0" aria-hidden />
              Publieke boekpagina
            </a>
            <button
              type="button"
              onClick={() => {
                setPinMsg(null);
                setPinOpen((o) => !o);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/80 px-3 py-2 text-sm text-white hover:bg-emerald-900/40"
            >
              <KeyRound className="size-4 shrink-0" aria-hidden />
              PIN tablet
            </button>
            <SignOutButton variant="header" className="border border-emerald-700/80 text-white hover:bg-emerald-900/40" redirectNext={agendaPath} />
          </div>
        </div>
      </header>

      {pinOpen ? (
        <div className="border-b border-emerald-900/30 bg-emerald-900/20 px-4 py-4 dark:bg-emerald-950/50">
          <div className="mx-auto max-w-md space-y-3">
            <p className="text-sm text-emerald-100">
              Optioneel: na inloggen op een gedeelde tablet kunnen medewerkers deze korte PIN invoeren i.p.v. opnieuw het
              volledige wachtwoord (alleen op dit apparaat, tot uitloggen).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-emerald-200">
                Nieuwe PIN (4–6 cijfers)
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinNew}
                  onChange={(e) => setPinNew(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 w-full rounded border border-emerald-800 bg-emerald-950 px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="text-xs text-emerald-200">
                Bevestigen
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 w-full rounded border border-emerald-800 bg-emerald-950 px-2 py-1.5 text-sm text-white"
                />
              </label>
            </div>
            {pinMsg ? <p className="text-xs text-amber-200">{pinMsg}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pinBusy}
                onClick={() => void savePin(false)}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-100 disabled:opacity-50"
              >
                PIN opslaan
              </button>
              <button
                type="button"
                disabled={pinBusy}
                onClick={() => void savePin(true)}
                className="rounded-lg border border-emerald-600 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-50"
              >
                PIN verwijderen
              </button>
              <button
                type="button"
                onClick={() => {
                  setPinOpen(false);
                  setPinMsg(null);
                }}
                className="text-sm text-emerald-200 underline"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PortalAppointmentNotifier slug={slug} appointmentsEnabled={appointmentsEnabled} />

      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}

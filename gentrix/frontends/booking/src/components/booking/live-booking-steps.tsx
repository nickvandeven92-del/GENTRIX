/**
 * Alleen voor {@link BookingPageLive}: UI gekoppeld aan `useGentrixPublicBooking`.
 * Geen import uit de mock-demo (`BookingFlow` / `BusinessContext`).
 */
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar, CheckCircle2, Clock, Loader2, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GentrixPublicBookingController } from "@/hooks/use-gentrix-public-booking";
import { formatPriceEur, type PublicBookingService, type BookingMeta } from "@/lib/gentrix-booking-helpers";
import { cn } from "@/lib/utils";

const ACCENT_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f97316", "#ec4899"];

function serviceAccent(i: number) {
  return ACCENT_COLORS[i % ACCENT_COLORS.length]!;
}

type LiveServicePickProps = {
  services: PublicBookingService[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNext: () => void;
};

export function LiveServicePick({ services, selectedId, loading, onSelect, onNext }: LiveServicePickProps) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Behandelingen laden…
      </p>
    );
  }
  return (
    <div>
      <h2 className="mb-2 font-heading text-2xl font-bold">Kies een dienst</h2>
      <p className="mb-6 text-muted-foreground">Selecteer de dienst waarvoor je een afspraak wilt maken.</p>
      <div className="grid gap-3">
        {services.map((svc, i) => {
          const on = selectedId === svc.id;
          const pl = formatPriceEur(svc.price_cents);
          return (
            <Card
              key={svc.id}
              className={cn(
                "cursor-pointer p-4 transition-all hover:border-primary/40 hover:shadow-md",
                on && "border-primary ring-2 ring-primary/30",
              )}
              onClick={() => onSelect(svc.id)}
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-3 shrink-0 rounded-full" style={{ backgroundColor: serviceAccent(i) }} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading font-semibold">{svc.name}</h3>
                  {svc.description?.trim() ? <p className="truncate text-sm text-muted-foreground">{svc.description}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {svc.duration_minutes} min{pl ? ` · ${pl}` : ""}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Button type="button" className="mt-6 w-full sm:w-auto" onClick={onNext}>
        Verder
      </Button>
    </div>
  );
}

type LiveEmployeePickProps = {
  staff: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
};

export function LiveEmployeePick({ staff, selectedId, onSelect, onNext }: LiveEmployeePickProps) {
  return (
    <div>
      <h2 className="mb-2 font-heading text-2xl font-bold">Kies een medewerker</h2>
      <p className="mb-6 text-muted-foreground">Bij wie wil je je afspraak maken?</p>
      <div className="grid gap-3">
        {staff.map((emp) => {
          const on = selectedId === emp.id;
          const initials = emp.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <Card
              key={emp.id}
              className={cn(
                "cursor-pointer p-4 transition-all hover:border-primary/40 hover:shadow-md",
                on && "border-primary ring-2 ring-primary/30",
              )}
              onClick={() => onSelect(emp.id)}
            >
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent font-heading font-bold text-accent-foreground">
                  {initials}
                </div>
                <div>
                  <h3 className="font-heading font-semibold">{emp.name}</h3>
                  <p className="text-sm text-muted-foreground">Medewerker · Online boeken</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Button type="button" className="mt-6 w-full sm:w-auto" onClick={onNext}>
        Verder naar datum & tijd
      </Button>
    </div>
  );
}

type LiveDetailsFormProps = {
  b: GentrixPublicBookingController;
  onContinue: () => void;
};

export function LiveDetailsForm({ b, onContinue }: LiveDetailsFormProps) {
  const [name, setName] = useState(b.bookerName);
  const [email, setEmail] = useState(b.bookerEmail);
  const [phone, setPhone] = useState("");
  const [extraNotes, setExtraNotes] = useState("");

  useEffect(() => {
    setName(b.bookerName);
    setEmail(b.bookerEmail);
  }, [b.bookerName, b.bookerEmail]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      b.setErr("Naam is verplicht.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      b.setErr("Vul een geldig e-mailadres in.");
      return;
    }
    b.setBookerName(name.trim());
    b.setBookerEmail(email.trim());
    const parts: string[] = [];
    if (phone.trim()) parts.push(`Tel: ${phone.trim()}`);
    if (extraNotes.trim()) parts.push(extraNotes.trim());
    b.setNotes(parts.join("\n"));
    b.setErr(null);
    onContinue();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 font-heading text-2xl font-bold">Jouw gegevens</h2>
        <p className="text-muted-foreground">Vul je contactgegevens in zodat we je afspraak kunnen bevestigen.</p>
      </div>
      <Card className="p-6">
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="live-name">Naam *</Label>
            <Input id="live-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Je volledige naam" autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="live-email">E-mail *</Label>
            <Input
              id="live-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="je@email.nl"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="live-phone">Telefoon (optioneel)</Label>
            <Input id="live-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06-12345678" />
          </div>
          <div>
            <Label htmlFor="live-notes">Opmerking (optioneel)</Label>
            <Textarea id="live-notes" value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} rows={3} />
          </div>
          <Button type="submit" className="w-full">
            Controleren & bevestigen
          </Button>
        </form>
      </Card>

      <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
        <Label className="text-xs text-muted-foreground">
          Soort afspraak (optioneel)
          <Input
            value={b.title}
            onChange={(e) => b.setTitle(e.target.value)}
            className="mt-1"
            placeholder="Bijv. Intake"
          />
        </Label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={b.wantsConfirmation}
            onChange={(e) => b.setWantsConfirmation(e.target.checked)}
            className="mt-0.5"
          />
          <span>Ja, stuur mij een bevestiging per e-mail (inclusief agenda-bestand).</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" checked={b.wantsReminder} onChange={(e) => b.setWantsReminder(e.target.checked)} className="mt-0.5" />
          <span>Herinner mij één dag van tevoren per e-mail.</span>
        </label>
      </div>
    </div>
  );
}

type LiveConfirmProps = {
  b: GentrixPublicBookingController;
  meta: BookingMeta;
  businessLabel: string;
  date: Date;
  timeLabel: string;
  onConfirm: () => void;
};

export function LiveConfirmCard({ b, meta, businessLabel, date, timeLabel, onConfirm }: LiveConfirmProps) {
  const svc = b.selectedService;
  const staffName =
    b.staffCatalog.staff.length > 0 && b.pickedStaffId
      ? b.staffCatalog.staff.find((x) => x.id === b.pickedStaffId)?.name ?? null
      : null;

  const priceLabel = svc ? formatPriceEur(svc.price_cents) : null;
  const accent = svc ? serviceAccent(b.publicServices.findIndex((x) => x.id === svc.id)) : ACCENT_COLORS[0]!;

  return (
    <div>
      <h2 className="mb-2 font-heading text-2xl font-bold">Bevestig je afspraak</h2>
      <p className="mb-6 text-muted-foreground">Controleer de gegevens en bevestig je boeking.</p>
      <Card className="space-y-4 p-6">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-1.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
            <div>
              <p className="font-heading font-semibold">{svc?.name ?? "Afspraak"}</p>
              <p className="text-sm text-muted-foreground">
                {svc ? `${svc.duration_minutes} min` : `${meta.slotDurationMinutes} min`}
                {priceLabel ? ` · ${priceLabel}` : ""}
              </p>
            </div>
          </div>
          {staffName ? (
            <div className="flex items-center gap-3 text-sm">
              <User className="size-4 text-muted-foreground" />
              <span>{staffName}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="size-4 text-muted-foreground" />
            <span>{format(date, "EEEE d MMMM yyyy", { locale: nl })}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Clock className="size-4 text-muted-foreground" />
            <span>{timeLabel}</span>
          </div>
        </div>
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium text-muted-foreground">Locatie / zaak</p>
          <p className="text-sm font-medium">{businessLabel}</p>
          <p className="text-sm font-medium text-muted-foreground">Jouw gegevens</p>
          <div className="flex items-center gap-3 text-sm">
            <User className="size-4 text-muted-foreground" />
            <span>{b.bookerName.trim() || "—"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="size-4 text-muted-foreground" />
            <span>{b.bookerEmail.trim()}</span>
          </div>
          {b.notes.trim() ? <p className="text-sm italic text-muted-foreground">&ldquo;{b.notes.trim()}&rdquo;</p> : null}
        </div>
        <Button className="w-full" size="lg" disabled={b.saving} onClick={onConfirm}>
          {b.saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Bezig…
            </>
          ) : (
            "Afspraak bevestigen"
          )}
        </Button>
      </Card>
    </div>
  );
}

type LiveSuccessProps = {
  b: GentrixPublicBookingController;
  businessLabel: string;
  date: Date;
  timeLabel: string;
  onNew: () => void;
};

export function LiveSuccessCard({ b, businessLabel, date, timeLabel, onNew }: LiveSuccessProps) {
  const svc = b.selectedService;
  const staffName =
    b.staffCatalog.staff.length > 0 && b.pickedStaffId
      ? b.staffCatalog.staff.find((x) => x.id === b.pickedStaffId)?.name ?? businessLabel
      : businessLabel;

  return (
    <div className="text-center">
      <Card className="mx-auto max-w-md p-8">
        <CheckCircle2 className="mx-auto mb-4 size-16 text-primary" />
        <h2 className="mb-2 font-heading text-2xl font-bold">Afspraak bevestigd!</h2>
        <p className="mb-6 text-muted-foreground">Je afspraak is succesvol geboekt.</p>
        <div className="mb-6 space-y-2 rounded-lg bg-muted p-4 text-left text-sm">
          <p>
            <span className="font-medium">Dienst:</span> {svc?.name ?? "Afspraak"}
          </p>
          <p>
            <span className="font-medium">Medewerker:</span> {staffName}
          </p>
          <p>
            <span className="font-medium">Datum:</span> {format(date, "EEEE d MMMM yyyy", { locale: nl })}
          </p>
          <p>
            <span className="font-medium">Tijd:</span> {timeLabel}
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={onNew}>
          Nieuwe afspraak maken
        </Button>
      </Card>
    </div>
  );
}

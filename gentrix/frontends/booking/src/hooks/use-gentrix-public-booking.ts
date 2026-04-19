import { useCallback, useEffect, useMemo, useState } from "react";
import { publicBookingApiUrls } from "@/lib/gentrix-api";
import {
  buildMonthGrid,
  type BookingMeta,
  type PublicBookingService,
  type PublicBookingSlot,
} from "@/lib/gentrix-booking-helpers";

export type StaffCatalogState = {
  loading: boolean;
  err: string | null;
  /** True wanneer er meerdere actieve medewerkers zijn (keuze vóór datum). */
  requiresStaffSelection: boolean;
  staff: { id: string; name: string }[];
};

type UseGentrixPublicBookingArgs = { slug: string };

export function useGentrixPublicBooking({ slug }: UseGentrixPublicBookingArgs) {
  const enc = encodeURIComponent(slug);
  const { slots: slotsApi, staff: staffApi, services: servicesApi, appointments: bookApi } = publicBookingApiUrls(enc);

  const [publicServices, setPublicServices] = useState<PublicBookingService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const [meta, setMeta] = useState<BookingMeta | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [metaErr, setMetaErr] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [staffCatalog, setStaffCatalog] = useState<StaffCatalogState>({
    loading: true,
    err: null,
    requiresStaffSelection: false,
    staff: [],
  });

  const [viewY, setViewY] = useState(() => new Date().getFullYear());
  const [viewM, setViewM] = useState(() => new Date().getMonth() + 1);

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [pickedStaffId, setPickedStaffId] = useState<string | null>(null);
  const [slots, setSlots] = useState<PublicBookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PublicBookingSlot | null>(null);

  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [wantsConfirmation, setWantsConfirmation] = useState(false);
  const [wantsReminder, setWantsReminder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      setMetaErr(null);
      try {
        const res = await fetch(slotsApi);
        const json = (await res.json()) as {
          ok?: boolean;
          meta?: BookingMeta;
          businessName?: string;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.meta) {
          if (!cancelled) setMetaErr(json.error ?? "Boekagenda niet beschikbaar.");
          return;
        }
        if (!cancelled) {
          setMeta(json.meta);
          if (typeof json.businessName === "string" && json.businessName.trim()) {
            setBusinessName(json.businessName.trim());
          }
          const [ty, tm] = json.meta.todayYmd.split("-").map(Number);
          if (ty && tm) {
            setViewY(ty);
            setViewM(tm);
          }
        }
      } catch {
        if (!cancelled) setMetaErr("Netwerkfout.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slotsApi]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setServicesLoading(true);
      try {
        const res = await fetch(servicesApi);
        const json = (await res.json()) as { ok?: boolean; services?: PublicBookingService[] };
        if (!cancelled) {
          if (res.ok && json.ok) setPublicServices(json.services ?? []);
          else setPublicServices([]);
        }
      } catch {
        if (!cancelled) setPublicServices([]);
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [servicesApi]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStaffCatalog((s) => ({ ...s, loading: true, err: null }));
      try {
        const res = await fetch(staffApi);
        const json = (await res.json()) as {
          ok?: boolean;
          requiresStaffSelection?: boolean;
          staff?: { id: string; name: string }[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setStaffCatalog({
            loading: false,
            err: json.error ?? "Medewerkers laden mislukt.",
            requiresStaffSelection: false,
            staff: [],
          });
          return;
        }
        const st = json.staff ?? [];
        setStaffCatalog({
          loading: false,
          err: null,
          requiresStaffSelection: Boolean(json.requiresStaffSelection),
          staff: st,
        });
      } catch {
        if (!cancelled) {
          setStaffCatalog({
            loading: false,
            err: "Netwerkfout.",
            requiresStaffSelection: false,
            staff: [],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staffApi]);

  /** Eén actieve medewerker: altijd die id voor slot-API. */
  useEffect(() => {
    if (staffCatalog.loading || staffCatalog.err) return;
    if (staffCatalog.staff.length === 1) {
      setPickedStaffId(staffCatalog.staff[0]!.id);
    }
    if (staffCatalog.staff.length === 0) {
      setPickedStaffId(null);
    }
  }, [staffCatalog.loading, staffCatalog.err, staffCatalog.staff]);

  const requiresTreatmentChoice = publicServices.length > 0;
  const selectedService = publicServices.find((s) => s.id === selectedServiceId) ?? null;

  const loadSlots = useCallback(
    async (dateYmd: string, staffId: string | null, serviceForQuery: string | null) => {
      setLoadingSlots(true);
      setErr(null);
      setSelectedSlot(null);
      try {
        let url = `${slotsApi}?date=${encodeURIComponent(dateYmd)}`;
        if (staffId) url += `&staff=${encodeURIComponent(staffId)}`;
        if (serviceForQuery) url += `&service=${encodeURIComponent(serviceForQuery)}`;
        const res = await fetch(url);
        const json = (await res.json()) as { ok?: boolean; slots?: PublicBookingSlot[]; error?: string };
        if (!res.ok || !json.ok) {
          setSlots([]);
          setErr(json.error ?? "Slots laden mislukt.");
          return;
        }
        setSlots(json.slots ?? []);
      } catch {
        setSlots([]);
        setErr("Netwerkfout.");
      } finally {
        setLoadingSlots(false);
      }
    },
    [slotsApi],
  );

  useEffect(() => {
    if (!selectedYmd) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    if (requiresTreatmentChoice && !selectedServiceId) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    if (staffCatalog.loading || staffCatalog.err) return;
    const needsStaff = staffCatalog.staff.length > 0;
    if (needsStaff && !pickedStaffId) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }
    const svcQ = requiresTreatmentChoice && selectedServiceId ? selectedServiceId : null;
    void loadSlots(selectedYmd, needsStaff ? pickedStaffId : null, svcQ);
  }, [
    selectedYmd,
    pickedStaffId,
    staffCatalog.loading,
    staffCatalog.err,
    staffCatalog.staff.length,
    requiresTreatmentChoice,
    selectedServiceId,
    loadSlots,
  ]);

  const grid = useMemo(() => {
    if (!meta) return [];
    return buildMonthGrid(viewY, viewM, meta.timeZone);
  }, [viewY, viewM, meta]);

  function slotLabel(s: PublicBookingSlot): string {
    if (!meta) return s.starts_at;
    return new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: meta.timeZone,
    }).format(new Date(s.starts_at));
  }

  async function submitBooking(): Promise<{ ok: true; hadConfirmation: boolean } | { ok: false }> {
    setErr(null);
    if (!selectedSlot) {
      setErr("Kies een datum en tijdslot.");
      return { ok: false };
    }
    const needsStaff = staffCatalog.staff.length > 0;
    if (needsStaff && !pickedStaffId) {
      setErr("Kies een medewerker.");
      return { ok: false };
    }
    if (requiresTreatmentChoice && !selectedServiceId) {
      setErr("Kies een behandeling.");
      return { ok: false };
    }
    const email = bookerEmail.trim();
    if (!email || !email.includes("@")) {
      setErr("Vul een geldig e-mailadres in.");
      return { ok: false };
    }
    setSaving(true);
    try {
      const res = await fetch(bookApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          starts_at: selectedSlot.starts_at,
          ends_at: selectedSlot.ends_at,
          notes: notes.trim() || null,
          staff_id: needsStaff ? pickedStaffId : undefined,
          booking_service_id: requiresTreatmentChoice ? selectedServiceId : undefined,
          booker_name: bookerName.trim() || null,
          booker_email: email,
          booker_wants_confirmation: wantsConfirmation,
          booker_wants_reminder: wantsReminder,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Boeken mislukt.");
        return { ok: false };
      }
      const hadConfirmation = wantsConfirmation;
      setTitle("");
      setNotes("");
      setBookerName("");
      setBookerEmail("");
      setWantsConfirmation(false);
      setWantsReminder(false);
      /** selectedSlot bewaren tot `resetFlow` — succes-scherm toont nog tijd/datum. */
      return { ok: true, hadConfirmation };
    } catch {
      setErr("Netwerkfout.");
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }

  function resetFlow() {
    setErr(null);
    setSelectedServiceId(null);
    setSelectedYmd(null);
    setPickedStaffId(null);
    setSlots([]);
    setSelectedSlot(null);
    setBookerName("");
    setBookerEmail("");
    setTitle("");
    setNotes("");
    setWantsConfirmation(false);
    setWantsReminder(false);
    if (meta) {
      const [ty, tm] = meta.todayYmd.split("-").map(Number);
      if (ty && tm) {
        setViewY(ty);
        setViewM(tm);
      }
    }
  }

  function selectService(id: string) {
    setSelectedServiceId(id);
    setSelectedYmd(null);
    setSlots([]);
    setSelectedSlot(null);
    if (staffCatalog.staff.length > 1) {
      setPickedStaffId(null);
    }
  }

  return {
    businessName,
    meta,
    metaErr,
    loadingMeta,
    publicServices,
    servicesLoading,
    requiresTreatmentChoice,
    selectedServiceId,
    selectedService,
    selectService,
    staffCatalog,
    viewY,
    viewM,
    setViewY,
    setViewM,
    grid,
    selectedYmd,
    setSelectedYmd,
    pickedStaffId,
    setPickedStaffId,
    slots,
    loadingSlots,
    selectedSlot,
    setSelectedSlot,
    slotLabel,
    bookerName,
    setBookerName,
    bookerEmail,
    setBookerEmail,
    title,
    setTitle,
    notes,
    setNotes,
    wantsConfirmation,
    setWantsConfirmation,
    wantsReminder,
    setWantsReminder,
    saving,
    err,
    setErr,
    submitBooking,
    resetFlow,
  };
}

export type GentrixPublicBookingController = ReturnType<typeof useGentrixPublicBooking>;

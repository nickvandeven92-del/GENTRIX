import { useCallback, useEffect, useMemo, useState } from "react";
import { publicBookingApiUrls } from "@/lib/gentrix-api";
import {
  buildMonthGrid,
  type PublicBookingService,
  type PublicBookingSlot,
  type StaffDayState,
} from "@/lib/gentrix-booking-helpers";

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

  const [viewY, setViewY] = useState(() => new Date().getFullYear());
  const [viewM, setViewM] = useState(() => new Date().getMonth() + 1);

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [staffForDay, setStaffForDay] = useState<StaffDayState>({
    loading: false,
    requiresStaffSelection: false,
    staff: [],
    err: null,
  });
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
      setStaffForDay({ loading: false, requiresStaffSelection: false, staff: [], err: null });
      setPickedStaffId(null);
      setSlots([]);
      return;
    }
    if (requiresTreatmentChoice && !selectedServiceId) {
      setStaffForDay({ loading: false, requiresStaffSelection: false, staff: [], err: null });
      setPickedStaffId(null);
      setSlots([]);
      return;
    }
    let cancelled = false;
    setStaffForDay((s) => ({ ...s, loading: true, err: null }));
    setPickedStaffId(null);
    void (async () => {
      try {
        let staffUrl = `${staffApi}?date=${encodeURIComponent(selectedYmd)}`;
        if (requiresTreatmentChoice && selectedServiceId) {
          staffUrl += `&service=${encodeURIComponent(selectedServiceId)}`;
        }
        const res = await fetch(staffUrl);
        const json = (await res.json()) as {
          ok?: boolean;
          requiresStaffSelection?: boolean;
          staff?: { id: string; name: string }[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setStaffForDay({
            loading: false,
            requiresStaffSelection: false,
            staff: [],
            err: json.error ?? "Medewerkers laden mislukt.",
          });
          setSlots([]);
          return;
        }
        const req = Boolean(json.requiresStaffSelection);
        const st = json.staff ?? [];
        setStaffForDay({ loading: false, requiresStaffSelection: req, staff: st, err: null });
        if (req && st.length === 1) setPickedStaffId(st[0]!.id);
      } catch {
        if (!cancelled) {
          setStaffForDay({
            loading: false,
            requiresStaffSelection: false,
            staff: [],
            err: "Netwerkfout.",
          });
          setSlots([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedYmd, staffApi, requiresTreatmentChoice, selectedServiceId]);

  useEffect(() => {
    if (!selectedYmd) return;
    if (staffForDay.loading || staffForDay.err) return;
    const svcQ = requiresTreatmentChoice && selectedServiceId ? selectedServiceId : null;
    if (staffForDay.requiresStaffSelection) {
      if (staffForDay.staff.length === 0) {
        setSlots([]);
        setLoadingSlots(false);
        return;
      }
      if (!pickedStaffId) {
        setSlots([]);
        setLoadingSlots(false);
        return;
      }
      void loadSlots(selectedYmd, pickedStaffId, svcQ);
      return;
    }
    void loadSlots(selectedYmd, null, svcQ);
  }, [selectedYmd, staffForDay, pickedStaffId, loadSlots, requiresTreatmentChoice, selectedServiceId]);

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
    if (staffForDay.requiresStaffSelection && !pickedStaffId) {
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
          staff_id: staffForDay.requiresStaffSelection ? pickedStaffId : undefined,
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
      setSelectedSlot(null);
      setSlots([]);
      setWantsConfirmation(false);
      setWantsReminder(false);
      if (selectedYmd) {
        const svcQ = requiresTreatmentChoice && selectedServiceId ? selectedServiceId : null;
        if (staffForDay.requiresStaffSelection && pickedStaffId) void loadSlots(selectedYmd, pickedStaffId, svcQ);
        else if (!staffForDay.requiresStaffSelection) void loadSlots(selectedYmd, null, svcQ);
      }
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
    setStaffForDay({ loading: false, requiresStaffSelection: false, staff: [], err: null });
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
    setStaffForDay({ loading: false, requiresStaffSelection: false, staff: [], err: null });
    setPickedStaffId(null);
    setSlots([]);
    setSelectedSlot(null);
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
    viewY,
    viewM,
    setViewY,
    setViewM,
    grid,
    selectedYmd,
    setSelectedYmd,
    staffForDay,
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

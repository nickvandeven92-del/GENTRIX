import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BusinessContext } from "@/context/BusinessContext";
import {
  buildBusinessFromPortal,
  emptyCategories,
  mapPortalAppointment,
  mapPortalEmployee,
  mapPortalService,
  type PortalAppointmentRow,
  type PortalBookingSettingsJson,
  type PortalServiceRow,
  type PortalStaffRow,
} from "@/lib/map-portal-owner-to-bookflow";
import { portalOwnerFetch } from "@/lib/portal-owner-fetch";
import type { Appointment, Business, Employee, Service, ServiceCategory } from "@/types";

type Bundle = {
  business: Business;
  services: Service[];
  employees: Employee[];
  appointments: Appointment[];
  categories: ServiceCategory[];
};

async function readJson<T>(res: Response): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const status = res.status;
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) return { ok: false, error: res.statusText, status };
    return { ok: true, data: { ok: true } as T, status };
  }
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "Ongeldig antwoord.", status };
  }
  const o = body as { ok?: boolean; error?: string };
  if (!res.ok || !o.ok) {
    return { ok: false, error: o.error ?? res.statusText, status };
  }
  return { ok: true, data: body as T, status };
}

export function LiveBusinessProvider({ children }: { children: React.ReactNode }) {
  const { ownerSlug: rawSlug } = useParams();
  const ownerSlug = decodeURIComponent(rawSlug ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);

  const load = useCallback(async () => {
    if (!ownerSlug) return;
    setErr(null);
    setLoading(true);
    try {
      const meRes = await portalOwnerFetch(ownerSlug, "/portal-me");
      const meJ = await readJson<{
        ok: boolean;
        clientId?: string;
        name?: string;
        appointmentsEnabled?: boolean;
        error?: string;
      }>(meRes);
      if (!meJ.ok || !meJ.data?.clientId || !meJ.data?.name) {
        setBundle(null);
        setErr(meJ.error ?? "Geen toegang.");
        return;
      }
      const clientId = meJ.data.clientId;
      const clientName = meJ.data.name;
      const apptsEnabled = meJ.data.appointmentsEnabled !== false;

      let settings: PortalBookingSettingsJson | null = null;
      if (apptsEnabled) {
        const setRes = await portalOwnerFetch(ownerSlug, "/booking-settings");
        const setJ = await readJson<{ ok: boolean; settings?: PortalBookingSettingsJson }>(setRes);
        if (setJ.ok && setJ.data?.settings) settings = setJ.data.settings;
      }

      if (!apptsEnabled) {
        setBundle({
          business: buildBusinessFromPortal({ clientId, name: clientName, slug: ownerSlug, settings }),
          services: [],
          employees: [],
          appointments: [],
          categories: emptyCategories(),
        });
        setErr(null);
        return;
      }

      const [apRes, stRes, svcRes] = await Promise.all([
        portalOwnerFetch(ownerSlug, "/appointments"),
        portalOwnerFetch(ownerSlug, "/staff"),
        portalOwnerFetch(ownerSlug, "/booking-services"),
      ]);

      const apJ = await readJson<{ ok: boolean; appointments?: unknown[] }>(apRes);
      const stJ = await readJson<{ ok: boolean; staff?: unknown[] }>(stRes);
      const svcJ = await readJson<{ ok: boolean; services?: unknown[] }>(svcRes);

      const appointmentsRaw = (apJ.ok ? apJ.data?.appointments : []) ?? [];
      const staffRaw = (stJ.ok ? stJ.data?.staff : []) ?? [];
      const servicesRaw = (svcJ.ok ? svcJ.data?.services : []) ?? [];

      const appointments = appointmentsRaw.map((r) => mapPortalAppointment(r as PortalAppointmentRow));
      const employees = staffRaw.map((r) => mapPortalEmployee(r as PortalStaffRow, clientId));
      const services = servicesRaw.map((r, i) => mapPortalService(r as PortalServiceRow, clientId, i));

      setBundle({
        business: buildBusinessFromPortal({ clientId, name: clientName, slug: ownerSlug, settings }),
        services,
        employees,
        appointments,
        categories: emptyCategories(),
      });
    } finally {
      setLoading(false);
    }
  }, [ownerSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const addAppointment = useCallback(
    async (appointment: Appointment) => {
      const starts = new Date(`${appointment.date}T${appointment.startTime}:00`);
      const ends = new Date(`${appointment.date}T${appointment.endTime}:00`);
      const res = await portalOwnerFetch(ownerSlug, "/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: appointment.customer.name.trim() || "Afspraak",
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          notes: appointment.notes?.trim() || null,
          staff_id: appointment.employeeId || null,
          booking_service_id: appointment.serviceId || null,
          booker_name: appointment.customer.name.trim() || null,
          booker_email: appointment.customer.email.trim() || null,
          booker_wants_confirmation: false,
          booker_wants_reminder: false,
        }),
      });
      const j = await readJson(res);
      if (!j.ok) {
        toast.error(j.error ?? "Aanmaken mislukt.");
        return;
      }
      toast.success("Afspraak toegevoegd.");
      await load();
    },
    [ownerSlug, load],
  );

  const updateAppointment = useCallback(
    async (id: string, updates: Partial<Appointment>) => {
      const body: Record<string, unknown> = {};
      if (updates.status === "cancelled") body.status = "cancelled";
      if (Object.keys(body).length === 0) {
        toast.message("Deze wijziging is nog niet gekoppeld aan het portaal. Gebruik het Gentrix-portaal voor uitgebreide bewerkingen.");
        return;
      }
      const res = await portalOwnerFetch(ownerSlug, `/appointments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await readJson(res);
      if (!j.ok) {
        toast.error(j.error ?? "Bijwerken mislukt.");
        return;
      }
      toast.success("Afspraak bijgewerkt.");
      await load();
    },
    [ownerSlug, load],
  );

  const addService = useCallback(
    async (service: Service) => {
      const res = await portalOwnerFetch(ownerSlug, "/booking-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: service.name,
          description: service.description?.trim() || null,
          duration_minutes: service.duration,
          price_cents: service.price != null ? Math.round(service.price * 100) : null,
        }),
      });
      const j = await readJson(res);
      if (!j.ok) {
        toast.error(j.error ?? "Dienst aanmaken mislukt.");
        return;
      }
      toast.success("Dienst aangemaakt.");
      await load();
    },
    [ownerSlug, load],
  );

  const updateService = useCallback(
    async (id: string, updates: Partial<Service>) => {
      const body: Record<string, unknown> = {};
      if (updates.name !== undefined) body.name = updates.name;
      if (updates.description !== undefined) body.description = updates.description?.trim() || null;
      if (updates.duration !== undefined) body.duration_minutes = updates.duration;
      if (updates.price !== undefined) body.price_cents = updates.price != null ? Math.round(updates.price * 100) : null;
      if (updates.active !== undefined) body.is_active = updates.active;
      if (Object.keys(body).length === 0) return;
      const res = await portalOwnerFetch(ownerSlug, `/booking-services/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await readJson(res);
      if (!j.ok) {
        toast.error(j.error ?? "Bijwerken mislukt.");
        return;
      }
      toast.success("Dienst bijgewerkt.");
      await load();
    },
    [ownerSlug, load],
  );

  const deleteService = useCallback(
    async (id: string) => {
      const res = await portalOwnerFetch(ownerSlug, `/booking-services/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const j = await readJson(res);
      if (!j.ok) {
        toast.error(j.error ?? "Verwijderen mislukt.");
        return;
      }
      toast.success("Dienst verwijderd.");
      await load();
    },
    [ownerSlug, load],
  );

  const addEmployee = useCallback((_e: Employee) => {
    toast.message("Medewerkers beheer je in het Gentrix-portaal onder «Medewerkers».");
  }, []);

  const updateEmployee = useCallback((_id: string, _u: Partial<Employee>) => {
    toast.message("Medewerkers beheer je in het Gentrix-portaal onder «Medewerkers».");
  }, []);

  const deleteEmployee = useCallback((_id: string) => {
    toast.message("Medewerkers beheer je in het Gentrix-portaal onder «Medewerkers».");
  }, []);

  const updateSettings = useCallback((_s: Partial<Business["settings"]>) => {
    toast.message("Agenda-instellingen wijzig je in het Gentrix-portaal onder «Boeken» / instellingen.");
  }, []);

  const value = useMemo(() => {
    if (!bundle) return null;
    return {
      currentBusinessId: bundle.business.id,
      setCurrentBusinessId: () => {},
      business: bundle.business,
      services: bundle.services,
      employees: bundle.employees,
      appointments: bundle.appointments,
      categories: bundle.categories,
      allBusinesses: [] as Business[],
      addAppointment,
      updateAppointment,
      addService,
      updateService,
      deleteService,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      updateSettings,
    };
  }, [
    bundle,
    addAppointment,
    updateAppointment,
    addService,
    updateService,
    deleteService,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    updateSettings,
  ]);

  if (!ownerSlug) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
        Ongeldige dashboard-URL. Open{" "}
        <Link className="ml-1 text-primary underline" to="..">
          de startpagina
        </Link>
        .
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Zaakgegevens laden…
      </div>
    );
  }

  if (err || !value) {
    const nextPath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/dashboard/${encodeURIComponent(ownerSlug)}`;
    const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
    const portalHref = `/portal/${encodeURIComponent(ownerSlug)}`;
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <h1 className="font-heading text-xl font-bold">Dashboard niet beschikbaar</h1>
        <p className="text-sm text-muted-foreground">{err ?? "Geen gegevens."}</p>
        <p className="text-sm text-muted-foreground">
          Dit dashboard gebruikt dezelfde gegevens als het Gentrix-klantportaal. Log in met je portaalaccount en open deze pagina opnieuw.
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={loginHref}>
            Naar inloggen
          </a>
          <a className="inline-flex rounded-lg border px-4 py-2 text-sm" href={portalHref}>
            Naar portaal (volledig)
          </a>
        </div>
      </div>
    );
  }

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

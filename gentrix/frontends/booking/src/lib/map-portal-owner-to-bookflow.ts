import type { Appointment, Business, Employee, Service, ServiceCategory } from "@/types";

/** Zelfde weekstructuur als mock (dashboard-pagina’s verwachten openingHours). */
const STUB_OPENING_HOURS: Business["settings"]["openingHours"] = {
  monday: { enabled: true, blocks: [{ start: "09:00", end: "17:00" }] },
  tuesday: { enabled: true, blocks: [{ start: "09:00", end: "17:00" }] },
  wednesday: { enabled: true, blocks: [{ start: "09:00", end: "17:00" }] },
  thursday: { enabled: true, blocks: [{ start: "09:00", end: "17:00" }] },
  friday: { enabled: true, blocks: [{ start: "09:00", end: "17:00" }] },
  saturday: { enabled: true, blocks: [{ start: "10:00", end: "15:00" }] },
  sunday: { enabled: false, blocks: [] },
};

export type PortalBookingSettingsJson = {
  slotDurationMinutes?: number;
  bufferMinutes?: number;
  maxDaysAhead?: number;
};

export type PortalAppointmentRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  staff_id: string | null;
  booking_service_id: string | null;
  booker_name: string | null;
  booker_email: string | null;
};

export type PortalStaffRow = {
  id: string;
  name: string;
  color_hex?: string | null;
  is_active?: boolean | null;
};

export type PortalServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  is_active: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function localYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtHm(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Portal gebruikt o.a. `scheduled`; BookFlow-demo gebruikt `confirmed` / `pending`. */
function mapAppointmentStatus(raw: string): Appointment["status"] {
  if (raw === "cancelled") return "cancelled";
  if (raw === "completed") return "completed";
  if (raw === "pending") return "pending";
  return "confirmed";
}

export function mapPortalAppointment(row: PortalAppointmentRow): Appointment {
  const start = new Date(row.starts_at);
  const date = Number.isNaN(start.getTime()) ? new Date().toISOString().slice(0, 10) : localYmd(start);
  return {
    id: row.id,
    businessId: "",
    serviceId: row.booking_service_id ?? "",
    employeeId: row.staff_id ?? "",
    date,
    startTime: fmtHm(row.starts_at),
    endTime: fmtHm(row.ends_at),
    status: mapAppointmentStatus(row.status),
    customer: {
      name: row.booker_name?.trim() || "Onbekend",
      email: row.booker_email?.trim() || "",
      phone: "",
      notes: row.notes?.trim() || undefined,
    },
    notes: row.notes?.trim() || undefined,
    createdAt: row.starts_at,
  };
}

function hexToServiceColor(hex: string | null | undefined, fallback: string) {
  const h = hex?.trim();
  if (h && /^#[0-9A-Fa-f]{6}$/.test(h)) return h;
  return fallback;
}

export function mapPortalService(row: PortalServiceRow, businessId: string, index: number): Service {
  const palette = ["#0d9488", "#0891b2", "#6366f1", "#d97706", "#059669", "#dc2626"];
  const price = row.price_cents != null ? row.price_cents / 100 : null;
  return {
    id: row.id,
    businessId,
    name: row.name,
    description: row.description?.trim() || "",
    duration: row.duration_minutes,
    price,
    color: hexToServiceColor(null, palette[index % palette.length]!),
    active: Boolean(row.is_active),
    employeeIds: [],
  };
}

export function mapPortalEmployee(row: PortalStaffRow, businessId: string): Employee {
  return {
    id: row.id,
    businessId,
    name: row.name,
    role: "Medewerker",
    specialization: "Online boeken",
    serviceIds: [],
    schedule: STUB_OPENING_HOURS,
    breaks: [],
    daysOff: [],
    active: row.is_active !== false,
  };
}

export function buildBusinessFromPortal(args: {
  clientId: string;
  name: string;
  slug: string;
  settings?: PortalBookingSettingsJson | null;
}): Business {
  const s = args.settings ?? {};
  return {
    id: args.clientId,
    name: args.name,
    slug: args.slug,
    description: "",
    industry: "Kapsalon",
    phone: "",
    email: "",
    address: "",
    settings: {
      slotInterval: s.slotDurationMinutes ?? 30,
      bufferTime: s.bufferMinutes ?? 0,
      maxAdvanceBookingDays: s.maxDaysAhead ?? 60,
      minCancelHours: 24,
      openingHours: STUB_OPENING_HOURS,
      showServicesPage: true,
    },
  };
}

export function emptyCategories(): ServiceCategory[] {
  return [];
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  description: string;
  industry: string;
  phone: string;
  email: string;
  address: string;
  settings: BusinessSettings;
}

export interface BusinessSettings {
  slotInterval: number; // in minutes (15, 30, 60)
  bufferTime: number; // buffer between appointments in minutes
  maxAdvanceBookingDays: number;
  minCancelHours: number;
  openingHours: WeekSchedule;
  showServicesPage: boolean; // toggle services page visibility on website
}

export interface WeekSchedule {
  [day: string]: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  blocks: TimeBlock[];
}

export interface TimeBlock {
  start: string; // "09:00"
  end: string;   // "17:00"
}

export interface ServiceCategory {
  id: string;
  name: string;
  businessId: string;
}

export interface Service {
  id: string;
  businessId: string;
  name: string;
  description: string;
  duration: number; // in minutes
  price: number | null;
  color: string;
  categoryId?: string;
  active: boolean;
  employeeIds: string[];
}

export interface Employee {
  id: string;
  businessId: string;
  name: string;
  avatar?: string;
  role: string;
  specialization: string;
  serviceIds: string[];
  schedule: WeekSchedule;
  breaks: EmployeeBreak[];
  daysOff: DayOff[];
  active: boolean;
}

export interface EmployeeBreak {
  id: string;
  label: string;
  day: string; // "monday" | "all"
  start: string;
  end: string;
}

export interface DayOff {
  id: string;
  type: 'vacation' | 'sick' | 'personal' | 'blocked';
  startDate: string; // ISO date
  endDate: string;
  reason?: string;
}

export interface Appointment {
  id: string;
  businessId: string;
  serviceId: string;
  employeeId: string;
  date: string; // ISO date
  startTime: string; // "10:00"
  endTime: string;   // "10:45"
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  customer: CustomerInfo;
  notes?: string;
  createdAt: string;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  notes?: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export type BookingStep = 'service' | 'employee' | 'datetime' | 'details' | 'confirm' | 'success';

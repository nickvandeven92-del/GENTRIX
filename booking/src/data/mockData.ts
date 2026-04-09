import { Business, Service, Employee, Appointment, ServiceCategory } from '@/types';

const defaultWeekSchedule = {
  monday: { enabled: true, blocks: [{ start: '09:00', end: '17:00' }] },
  tuesday: { enabled: true, blocks: [{ start: '09:00', end: '17:00' }] },
  wednesday: { enabled: true, blocks: [{ start: '09:00', end: '17:00' }] },
  thursday: { enabled: true, blocks: [{ start: '09:00', end: '17:00' }] },
  friday: { enabled: true, blocks: [{ start: '09:00', end: '17:00' }] },
  saturday: { enabled: true, blocks: [{ start: '10:00', end: '15:00' }] },
  sunday: { enabled: false, blocks: [] },
};

// ========== BUSINESS 1: KAPPER ==========
export const kapperBusiness: Business = {
  id: 'biz-1',
  name: 'Studio Knipt',
  slug: 'studio-knipt',
  description: 'Moderne kapsalon in het hart van Amsterdam',
  industry: 'Kapsalon',
  phone: '020-1234567',
  email: 'info@studioknipt.nl',
  address: 'Keizersgracht 123, Amsterdam',
  settings: {
    slotInterval: 15,
    bufferTime: 5,
    maxAdvanceBookingDays: 30,
    minCancelHours: 24,
    openingHours: defaultWeekSchedule,
    showServicesPage: true,
  },
};

export const kapperCategories: ServiceCategory[] = [
  { id: 'cat-k1', name: 'Knippen', businessId: 'biz-1' },
  { id: 'cat-k2', name: 'Styling', businessId: 'biz-1' },
  { id: 'cat-k3', name: 'Baard', businessId: 'biz-1' },
];

export const kapperServices: Service[] = [
  { id: 'srv-k1', businessId: 'biz-1', name: 'Knippen heren', description: 'Knipbeurt inclusief wassen en stylen', duration: 30, price: 32.50, color: '#0d9488', categoryId: 'cat-k1', active: true, employeeIds: ['emp-k1', 'emp-k2', 'emp-k3'] },
  { id: 'srv-k2', businessId: 'biz-1', name: 'Knippen dames', description: 'Knipbeurt inclusief wassen, knippen en föhnen', duration: 45, price: 45.00, color: '#0891b2', categoryId: 'cat-k1', active: true, employeeIds: ['emp-k1', 'emp-k2'] },
  { id: 'srv-k3', businessId: 'biz-1', name: 'Knippen kinderen', description: 'Knipbeurt voor kinderen t/m 12 jaar', duration: 20, price: 19.50, color: '#6366f1', categoryId: 'cat-k1', active: true, employeeIds: ['emp-k1', 'emp-k2', 'emp-k3'] },
  { id: 'srv-k4', businessId: 'biz-1', name: 'Baard trimmen', description: 'Professioneel baard trimmen en shapen', duration: 20, price: 18.00, color: '#d97706', categoryId: 'cat-k3', active: true, employeeIds: ['emp-k1', 'emp-k3'] },
  { id: 'srv-k5', businessId: 'biz-1', name: 'Contouren', description: 'Contouren bijwerken met tondeuse', duration: 15, price: 15.00, color: '#059669', categoryId: 'cat-k2', active: true, employeeIds: ['emp-k1', 'emp-k2', 'emp-k3'] },
  { id: 'srv-k6', businessId: 'biz-1', name: 'Knippen + baard', description: 'Combi: knippen en baard trimmen', duration: 45, price: 45.00, color: '#dc2626', categoryId: 'cat-k1', active: true, employeeIds: ['emp-k1', 'emp-k3'] },
];

export const kapperEmployees: Employee[] = [
  {
    id: 'emp-k1', businessId: 'biz-1', name: 'Mohammed El Amrani', role: 'Senior Kapper', specialization: 'Heren & Baard', serviceIds: ['srv-k1', 'srv-k2', 'srv-k3', 'srv-k4', 'srv-k5', 'srv-k6'], active: true,
    schedule: { ...defaultWeekSchedule, wednesday: { enabled: false, blocks: [] } },
    breaks: [
      { id: 'brk-k1', label: 'Lunch', day: 'all', start: '12:30', end: '13:00' },
    ],
    daysOff: [
      { id: 'off-k1', type: 'vacation', startDate: '2026-04-20', endDate: '2026-04-24', reason: 'Vakantie' },
    ],
  },
  {
    id: 'emp-k2', businessId: 'biz-1', name: 'Sophie de Vries', role: 'Stylist', specialization: 'Dames & Kinderen', serviceIds: ['srv-k1', 'srv-k2', 'srv-k3', 'srv-k5'], active: true,
    schedule: defaultWeekSchedule,
    breaks: [
      { id: 'brk-k2', label: 'Lunch', day: 'all', start: '12:00', end: '12:30' },
      { id: 'brk-k3', label: 'Pauze', day: 'all', start: '15:00', end: '15:15' },
    ],
    daysOff: [],
  },
  {
    id: 'emp-k3', businessId: 'biz-1', name: 'Daan Jansen', role: 'Junior Kapper', specialization: 'Heren', serviceIds: ['srv-k1', 'srv-k3', 'srv-k4', 'srv-k5', 'srv-k6'], active: true,
    schedule: { ...defaultWeekSchedule, saturday: { enabled: false, blocks: [] } },
    breaks: [
      { id: 'brk-k4', label: 'Lunch', day: 'all', start: '12:00', end: '12:45' },
    ],
    daysOff: [
      { id: 'off-k2', type: 'sick', startDate: '2026-04-14', endDate: '2026-04-14', reason: 'Ziek' },
    ],
  },
];

// ========== BUSINESS 2: COACH ==========
export const coachBusiness: Business = {
  id: 'biz-2',
  name: 'Mindset Coaching',
  slug: 'mindset-coaching',
  description: 'Persoonlijke ontwikkeling & executive coaching',
  industry: 'Coaching & Consultancy',
  phone: '030-7654321',
  email: 'info@mindsetcoaching.nl',
  address: 'Maliebaan 45, Utrecht',
  settings: {
    slotInterval: 30,
    bufferTime: 15,
    maxAdvanceBookingDays: 60,
    minCancelHours: 48,
    showServicesPage: true,
    openingHours: {
      monday: { enabled: true, blocks: [{ start: '08:00', end: '18:00' }] },
      tuesday: { enabled: true, blocks: [{ start: '08:00', end: '18:00' }] },
      wednesday: { enabled: true, blocks: [{ start: '08:00', end: '18:00' }] },
      thursday: { enabled: true, blocks: [{ start: '08:00', end: '18:00' }] },
      friday: { enabled: true, blocks: [{ start: '08:00', end: '14:00' }] },
      saturday: { enabled: false, blocks: [] },
      sunday: { enabled: false, blocks: [] },
    },
  },
};

export const coachCategories: ServiceCategory[] = [
  { id: 'cat-c1', name: 'Coaching', businessId: 'biz-2' },
  { id: 'cat-c2', name: 'Consultancy', businessId: 'biz-2' },
];

export const coachServices: Service[] = [
  { id: 'srv-c1', businessId: 'biz-2', name: 'Intake gesprek', description: 'Kennismakingsgesprek om doelen en verwachtingen te bespreken', duration: 60, price: 0, color: '#0d9488', categoryId: 'cat-c1', active: true, employeeIds: ['emp-c1', 'emp-c2'] },
  { id: 'srv-c2', businessId: 'biz-2', name: 'Coaching sessie', description: 'Vervolg coachingsgesprek', duration: 90, price: 125.00, color: '#6366f1', categoryId: 'cat-c1', active: true, employeeIds: ['emp-c1', 'emp-c2'] },
  { id: 'srv-c3', businessId: 'biz-2', name: 'Executive coaching', description: 'Coaching gericht op leiderschap en management', duration: 120, price: 250.00, color: '#d97706', categoryId: 'cat-c1', active: true, employeeIds: ['emp-c1'] },
  { id: 'srv-c4', businessId: 'biz-2', name: 'Team workshop', description: 'Groepssessie voor teams (max 8 personen)', duration: 180, price: 750.00, color: '#dc2626', categoryId: 'cat-c2', active: true, employeeIds: ['emp-c1'] },
  { id: 'srv-c5', businessId: 'biz-2', name: 'Loopbaanadvies', description: 'Eenmalig adviesgesprek over carrière', duration: 60, price: 95.00, color: '#059669', categoryId: 'cat-c2', active: true, employeeIds: ['emp-c2'] },
];

export const coachEmployees: Employee[] = [
  {
    id: 'emp-c1', businessId: 'biz-2', name: 'Dr. Lisa van den Berg', role: 'Executive Coach', specialization: 'Leiderschap & Strategie', serviceIds: ['srv-c1', 'srv-c2', 'srv-c3', 'srv-c4'], active: true,
    schedule: {
      monday: { enabled: true, blocks: [{ start: '09:00', end: '17:00' }] },
      tuesday: { enabled: true, blocks: [{ start: '09:00', end: '17:00' }] },
      wednesday: { enabled: false, blocks: [] },
      thursday: { enabled: true, blocks: [{ start: '09:00', end: '17:00' }] },
      friday: { enabled: true, blocks: [{ start: '09:00', end: '13:00' }] },
      saturday: { enabled: false, blocks: [] },
      sunday: { enabled: false, blocks: [] },
    },
    breaks: [
      { id: 'brk-c1', label: 'Lunch', day: 'all', start: '12:30', end: '13:30' },
    ],
    daysOff: [],
  },
  {
    id: 'emp-c2', businessId: 'biz-2', name: 'Mark de Groot', role: 'Loopbaancoach', specialization: 'Loopbaan & Persoonlijke groei', serviceIds: ['srv-c1', 'srv-c2', 'srv-c5'], active: true,
    schedule: {
      monday: { enabled: true, blocks: [{ start: '08:00', end: '16:00' }] },
      tuesday: { enabled: true, blocks: [{ start: '08:00', end: '16:00' }] },
      wednesday: { enabled: true, blocks: [{ start: '08:00', end: '16:00' }] },
      thursday: { enabled: true, blocks: [{ start: '08:00', end: '16:00' }] },
      friday: { enabled: false, blocks: [] },
      saturday: { enabled: false, blocks: [] },
      sunday: { enabled: false, blocks: [] },
    },
    breaks: [
      { id: 'brk-c2', label: 'Lunch', day: 'all', start: '12:00', end: '12:45' },
    ],
    daysOff: [
      { id: 'off-c1', type: 'vacation', startDate: '2026-05-01', endDate: '2026-05-08', reason: 'Meivakantie' },
    ],
  },
];

// ========== APPOINTMENTS ==========
const today = new Date().toISOString().split('T')[0];

export const kapperAppointments: Appointment[] = [
  { id: 'apt-1', businessId: 'biz-1', serviceId: 'srv-k1', employeeId: 'emp-k1', date: today, startTime: '09:00', endTime: '09:30', status: 'confirmed', customer: { name: 'Jan de Boer', email: 'jan@email.nl', phone: '06-12345678' }, createdAt: '2026-04-07T10:00:00Z' },
  { id: 'apt-2', businessId: 'biz-1', serviceId: 'srv-k2', employeeId: 'emp-k2', date: today, startTime: '10:00', endTime: '10:45', status: 'confirmed', customer: { name: 'Maria Bakker', email: 'maria@email.nl', phone: '06-23456789' }, createdAt: '2026-04-07T11:00:00Z' },
  { id: 'apt-3', businessId: 'biz-1', serviceId: 'srv-k4', employeeId: 'emp-k1', date: today, startTime: '10:00', endTime: '10:20', status: 'confirmed', customer: { name: 'Peter Smit', email: 'peter@email.nl', phone: '06-34567890' }, createdAt: '2026-04-07T12:00:00Z' },
  { id: 'apt-4', businessId: 'biz-1', serviceId: 'srv-k6', employeeId: 'emp-k3', date: today, startTime: '13:00', endTime: '13:45', status: 'pending', customer: { name: 'Ahmed Hassan', email: 'ahmed@email.nl', phone: '06-45678901' }, createdAt: '2026-04-08T09:00:00Z' },
  { id: 'apt-5', businessId: 'biz-1', serviceId: 'srv-k1', employeeId: 'emp-k2', date: today, startTime: '14:00', endTime: '14:30', status: 'confirmed', customer: { name: 'Emma Visser', email: 'emma@email.nl', phone: '06-56789012' }, createdAt: '2026-04-08T10:00:00Z' },
];

export const coachAppointments: Appointment[] = [
  { id: 'apt-c1', businessId: 'biz-2', serviceId: 'srv-c1', employeeId: 'emp-c1', date: today, startTime: '09:00', endTime: '10:00', status: 'confirmed', customer: { name: 'Robert Hendriks', email: 'robert@company.nl', phone: '06-11223344' }, createdAt: '2026-04-06T14:00:00Z' },
  { id: 'apt-c2', businessId: 'biz-2', serviceId: 'srv-c2', employeeId: 'emp-c2', date: today, startTime: '10:00', endTime: '11:30', status: 'confirmed', customer: { name: 'Sandra Mulder', email: 'sandra@email.nl', phone: '06-22334455' }, createdAt: '2026-04-07T08:00:00Z' },
  { id: 'apt-c3', businessId: 'biz-2', serviceId: 'srv-c3', employeeId: 'emp-c1', date: today, startTime: '14:00', endTime: '16:00', status: 'pending', customer: { name: 'Thomas Vermeer', email: 'thomas@corp.nl', phone: '06-33445566', notes: 'Focus op teamleiderschap' }, createdAt: '2026-04-08T16:00:00Z' },
];

// Active business context (switch between businesses)
export const businesses = [kapperBusiness, coachBusiness];

export function getBusinessData(businessId: string) {
  if (businessId === 'biz-1') {
    return {
      business: kapperBusiness,
      services: kapperServices,
      employees: kapperEmployees,
      appointments: kapperAppointments,
      categories: kapperCategories,
    };
  }
  return {
    business: coachBusiness,
    services: coachServices,
    employees: coachEmployees,
    appointments: coachAppointments,
    categories: coachCategories,
  };
}

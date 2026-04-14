import { Employee, Service, Appointment, BusinessSettings, TimeSlot } from '@/types';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function getAvailableSlots(
  date: Date,
  employee: Employee,
  service: Service,
  appointments: Appointment[],
  settings: BusinessSettings
): TimeSlot[] {
  const dayName = DAYS[date.getDay()];
  const dateStr = date.toISOString().split('T')[0];

  // Check if employee works this day
  const empDay = employee.schedule[dayName];
  if (!empDay?.enabled || empDay.blocks.length === 0) return [];

  // Check business opening hours
  const bizDay = settings.openingHours[dayName];
  if (!bizDay?.enabled || bizDay.blocks.length === 0) return [];

  // Check days off
  const isOff = employee.daysOff.some(off => dateStr >= off.startDate && dateStr <= off.endDate);
  if (isOff) return [];

  // Get effective work blocks (intersection of employee and business hours)
  const workBlocks = empDay.blocks.map(empBlock => {
    const bizBlock = bizDay.blocks[0]; // simplified: use first business block
    return {
      start: Math.max(timeToMinutes(empBlock.start), timeToMinutes(bizBlock.start)),
      end: Math.min(timeToMinutes(empBlock.end), timeToMinutes(bizBlock.end)),
    };
  }).filter(b => b.start < b.end);

  // Get break periods
  const breakPeriods = employee.breaks
    .filter(brk => brk.day === 'all' || brk.day === dayName)
    .map(brk => ({ start: timeToMinutes(brk.start), end: timeToMinutes(brk.end) }));

  // Get existing appointments for this employee on this date
  const existingAppts = appointments
    .filter(a => a.employeeId === employee.id && a.date === dateStr && a.status !== 'cancelled')
    .map(a => ({
      start: timeToMinutes(a.startTime),
      end: timeToMinutes(a.endTime) + settings.bufferTime,
    }));

  const serviceDuration = service.duration;
  const interval = settings.slotInterval;
  const slots: TimeSlot[] = [];

  for (const block of workBlocks) {
    for (let time = block.start; time + serviceDuration <= block.end; time += interval) {
      const slotEnd = time + serviceDuration;

      // Check overlap with breaks
      const duringBreak = breakPeriods.some(
        brk => time < brk.end && slotEnd > brk.start
      );
      if (duringBreak) continue;

      // Check overlap with existing appointments
      const duringAppt = existingAppts.some(
        appt => time < appt.end && slotEnd > appt.start
      );

      slots.push({
        time: minutesToTime(time),
        available: !duringAppt,
      });
    }
  }

  return slots;
}

export function getAvailableDates(
  employee: Employee,
  service: Service,
  appointments: Appointment[],
  settings: BusinessSettings,
  daysAhead: number = 30
): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const slots = getAvailableSlots(date, employee, service, appointments, settings);
    if (slots.some(s => s.available)) {
      dates.push(date);
    }
  }

  return dates;
}

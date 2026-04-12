import { useState, useMemo } from 'react';
import { Employee, Service, Appointment, BusinessSettings } from '@/types';
import { getAvailableSlots } from '@/lib/availability';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { format, addDays, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';

interface Props {
  employee: Employee;
  service: Service;
  appointments: Appointment[];
  settings: BusinessSettings;
  onSelect: (date: Date, time: string) => void;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function DateTimeSelect({ employee, service, appointments, settings, onSelect }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDate = useMemo(() => addDays(today, settings.maxAdvanceBookingDays), [today, settings.maxAdvanceBookingDays]);

  // Pre-compute which dates have no availability at all
  const unavailableDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i <= settings.maxAdvanceBookingDays; i++) {
      const date = addDays(today, i);
      const dayName = DAYS[date.getDay()];

      // Quick checks before computing slots
      const empDay = employee.schedule[dayName];
      const bizDay = settings.openingHours[dayName];
      const dateStr = date.toISOString().split('T')[0];
      const isOff = employee.daysOff.some(off => dateStr >= off.startDate && dateStr <= off.endDate);

      if (!empDay?.enabled || !bizDay?.enabled || isOff) {
        dates.push(date);
        continue;
      }

      // Full slot check
      const slots = getAvailableSlots(date, employee, service, appointments, settings);
      const hasAvailable = slots.some(s => s.available);
      if (!hasAvailable) {
        dates.push(date);
      }
    }
    return dates;
  }, [employee, service, appointments, settings, today]);

  const slots = useMemo(() => {
    if (!selectedDate) return [];
    return getAvailableSlots(selectedDate, employee, service, appointments, settings);
  }, [selectedDate, employee, service, appointments, settings]);

  const availableSlots = slots.filter(s => s.available);

  // Determine if a date should be disabled (past, future, or unavailable)
  const isDateDisabled = (date: Date) => {
    if (date < today || date > maxDate) return true;
    return unavailableDates.some(d => isSameDay(d, date));
  };

  return (
    <div>
      <h2 className="text-2xl font-heading font-bold mb-2">Kies datum & tijd</h2>
      <p className="text-muted-foreground mb-6">
        {service.name} bij {employee.name} · {service.duration} min
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={isDateDisabled}
            modifiers={{
              unavailable: unavailableDates,
            }}
            modifiersClassNames={{
              unavailable: 'line-through text-muted-foreground opacity-50',
            }}
            className="rounded-lg border pointer-events-auto"
          />
        </div>

        <div>
          {selectedDate && (
            <div>
              <h3 className="font-heading font-semibold mb-3">
                {format(selectedDate, 'EEEE d MMMM', { locale: nl })}
              </h3>
              {availableSlots.length === 0 ? (
                <p className="text-muted-foreground text-sm">Geen beschikbare tijden op deze dag.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {availableSlots.map(slot => (
                    <Button
                      key={slot.time}
                      variant="outline"
                      size="sm"
                      onClick={() => onSelect(selectedDate, slot.time)}
                      className="hover:bg-primary hover:text-primary-foreground"
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!selectedDate && (
            <p className="text-muted-foreground text-sm">Selecteer een datum om beschikbare tijden te zien.</p>
          )}
        </div>
      </div>
    </div>
  );
}

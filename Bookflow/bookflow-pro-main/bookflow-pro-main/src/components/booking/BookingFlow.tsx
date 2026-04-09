import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookingStep, Service, Employee, CustomerInfo } from '@/types';
import { useBusiness } from '@/context/BusinessContext';
import { ServiceSelect } from './ServiceSelect';
import { EmployeeSelect } from './EmployeeSelect';
import { DateTimeSelect } from './DateTimeSelect';
import { CustomerForm } from './CustomerForm';
import { BookingConfirm } from './BookingConfirm';
import { BookingSuccess } from './BookingSuccess';
import { Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS: BookingStep[] = ['service', 'employee', 'datetime', 'details', 'confirm', 'success'];
const STEP_LABELS: Record<BookingStep, string> = {
  service: 'Dienst',
  employee: 'Medewerker',
  datetime: 'Datum & Tijd',
  details: 'Gegevens',
  confirm: 'Bevestig',
  success: 'Klaar',
};

export function BookingFlow() {
  const { business, services, employees, appointments, addAppointment } = useBusiness();
  const [step, setStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const currentIndex = STEPS.indexOf(step);

  const goBack = () => {
    if (currentIndex > 0) setStep(STEPS[currentIndex - 1]);
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedEmployee(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setStep('employee');
  };

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSelectedDate(null);
    setSelectedTime(null);
    setStep('datetime');
  };

  const handleDateTimeSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setStep('details');
  };

  const handleCustomerSubmit = (info: CustomerInfo) => {
    setCustomerInfo(info);
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (!selectedService || !selectedEmployee || !selectedDate || !selectedTime || !customerInfo) return;

    const endMinutes = selectedTime.split(':').map(Number).reduce((h, m) => h * 60 + m) + selectedService.duration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    const appointment = {
      id: `apt-${Date.now()}`,
      businessId: business.id,
      serviceId: selectedService.id,
      employeeId: selectedEmployee.id,
      date: selectedDate.toISOString().split('T')[0],
      startTime: selectedTime,
      endTime,
      status: 'confirmed' as const,
      customer: customerInfo,
      createdAt: new Date().toISOString(),
    };

    addAppointment(appointment);
    setStep('success');
  };

  const resetBooking = () => {
    setSelectedService(null);
    setSelectedEmployee(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setCustomerInfo(null);
    setStep('service');
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Stepper */}
      {step !== 'success' && (
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.filter(s => s !== 'success').map((s, i) => {
            const isActive = STEPS.indexOf(s) === currentIndex;
            const isDone = STEPS.indexOf(s) < currentIndex;
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isDone ? 'bg-primary text-primary-foreground' :
                    isActive ? 'bg-primary text-primary-foreground ring-4 ring-accent' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isDone ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < 4 && (
                  <div className={`flex-1 h-0.5 mx-2 ${isDone ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Back button */}
      {currentIndex > 0 && step !== 'success' && (
        <Button variant="ghost" onClick={goBack} className="mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" /> Terug
        </Button>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {step === 'service' && (
            <ServiceSelect services={services.filter(s => s.active)} onSelect={handleServiceSelect} />
          )}
          {step === 'employee' && selectedService && (
            <EmployeeSelect
              employees={employees.filter(e => e.active && e.serviceIds.includes(selectedService.id))}
              onSelect={handleEmployeeSelect}
            />
          )}
          {step === 'datetime' && selectedService && selectedEmployee && (
            <DateTimeSelect
              employee={selectedEmployee}
              service={selectedService}
              appointments={appointments}
              settings={business.settings}
              onSelect={handleDateTimeSelect}
            />
          )}
          {step === 'details' && (
            <CustomerForm onSubmit={handleCustomerSubmit} initialData={customerInfo} />
          )}
          {step === 'confirm' && selectedService && selectedEmployee && selectedDate && selectedTime && customerInfo && (
            <BookingConfirm
              service={selectedService}
              employee={selectedEmployee}
              date={selectedDate}
              time={selectedTime}
              customer={customerInfo}
              onConfirm={handleConfirm}
            />
          )}
          {step === 'success' && selectedService && selectedEmployee && selectedDate && selectedTime && (
            <BookingSuccess
              service={selectedService}
              employee={selectedEmployee}
              date={selectedDate}
              time={selectedTime}
              onNewBooking={resetBooking}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

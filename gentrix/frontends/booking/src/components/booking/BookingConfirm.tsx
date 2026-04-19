import { Service, Employee, CustomerInfo } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Calendar, Clock, User, Mail, Phone } from 'lucide-react';

interface Props {
  service: Service;
  employee: Employee;
  date: Date;
  time: string;
  customer: CustomerInfo;
  onConfirm: () => void;
  confirmDisabled?: boolean;
}

export function BookingConfirm({ service, employee, date, time, customer, onConfirm, confirmDisabled }: Props) {
  return (
    <div>
      <h2 className="text-2xl font-heading font-bold mb-2">Bevestig je afspraak</h2>
      <p className="text-muted-foreground mb-6">Controleer de gegevens en bevestig je boeking.</p>

      <Card className="p-6 space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: service.color }} />
            <div>
              <p className="font-heading font-semibold">{service.name}</p>
              <p className="text-sm text-muted-foreground">{service.duration} min {service.price !== null && service.price > 0 ? `· €${service.price.toFixed(2)}` : service.price === 0 ? '· Gratis' : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>
              {employee.name}
              {employee.role.trim() ? ` – ${employee.role}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{format(date, 'EEEE d MMMM yyyy', { locale: nl })}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{time}</span>
          </div>
        </div>

        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Jouw gegevens</p>
          <div className="flex items-center gap-3 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>{customer.name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span>{customer.email}</span>
          </div>
          {customer.phone.trim() ? (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{customer.phone}</span>
            </div>
          ) : null}
          {customer.notes && (
            <p className="text-sm text-muted-foreground italic">{`\u201c${customer.notes}\u201d`}</p>
          )}
        </div>

        <Button onClick={onConfirm} className="w-full" size="lg" disabled={confirmDisabled}>
          Afspraak bevestigen
        </Button>
      </Card>
    </div>
  );
}

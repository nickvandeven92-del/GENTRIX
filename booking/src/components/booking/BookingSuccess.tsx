import { Service, Employee } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  service: Service;
  employee: Employee;
  date: Date;
  time: string;
  onNewBooking: () => void;
}

export function BookingSuccess({ service, employee, date, time, onNewBooking }: Props) {
  return (
    <div className="text-center">
      <Card className="p-8 max-w-md mx-auto">
        <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-heading font-bold mb-2">Afspraak bevestigd!</h2>
        <p className="text-muted-foreground mb-6">Je afspraak is succesvol geboekt.</p>

        <div className="bg-muted rounded-lg p-4 text-left space-y-2 mb-6">
          <p className="text-sm"><span className="font-medium">Dienst:</span> {service.name}</p>
          <p className="text-sm"><span className="font-medium">Medewerker:</span> {employee.name}</p>
          <p className="text-sm"><span className="font-medium">Datum:</span> {format(date, 'EEEE d MMMM yyyy', { locale: nl })}</p>
          <p className="text-sm"><span className="font-medium">Tijd:</span> {time}</p>
        </div>

        <Button onClick={onNewBooking} variant="outline" className="w-full">
          Nieuwe afspraak maken
        </Button>
      </Card>
    </div>
  );
}

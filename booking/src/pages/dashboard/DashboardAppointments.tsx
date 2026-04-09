import { useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function DashboardAppointments() {
  const { appointments, services, employees, updateAppointment } = useBusiness();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');

  const filtered = appointments
    .filter(a => filterStatus === 'all' || a.status === filterStatus)
    .filter(a => filterEmployee === 'all' || a.employeeId === filterEmployee)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

  const statusColors: Record<string, string> = {
    confirmed: 'bg-primary/10 text-primary',
    pending: 'bg-warning/10 text-warning',
    cancelled: 'bg-destructive/10 text-destructive',
    completed: 'bg-muted text-muted-foreground',
  };

  const cancelAppointment = (id: string) => {
    updateAppointment(id, { status: 'cancelled' });
    toast.success('Afspraak geannuleerd');
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Afspraken</h1>
        <p className="text-muted-foreground text-sm">Overzicht van alle afspraken</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="confirmed">Bevestigd</SelectItem>
            <SelectItem value="pending">In afwachting</SelectItem>
            <SelectItem value="cancelled">Geannuleerd</SelectItem>
            <SelectItem value="completed">Voltooid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Medewerker" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle medewerkers</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <p className="text-muted-foreground text-sm">Geen afspraken gevonden.</p>}
        {filtered.map(apt => {
          const service = services.find(s => s.id === apt.serviceId);
          const employee = employees.find(e => e.id === apt.employeeId);
          return (
            <Card key={apt.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: service?.color || '#888' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{apt.customer.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[apt.status]}`}>{apt.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{service?.name} · {employee?.name}</p>
                  <p className="text-xs text-muted-foreground">{apt.customer.email} · {apt.customer.phone}</p>
                  {apt.notes && <p className="text-xs text-muted-foreground italic mt-1">"{apt.notes}"</p>}
                </div>
                <div className="text-right text-sm shrink-0">
                  <p className="font-medium">{apt.date}</p>
                  <p className="text-muted-foreground">{apt.startTime} – {apt.endTime}</p>
                </div>
                {apt.status !== 'cancelled' && (
                  <Button variant="ghost" size="sm" onClick={() => cancelAppointment(apt.id)} className="text-destructive text-xs shrink-0">
                    Annuleren
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

import { useBusiness } from '@/context/BusinessContext';
import { Card } from '@/components/ui/card';
import { CalendarDays, Users, Scissors, TrendingUp, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function DashboardOverview() {
  const { appointments, employees, services, business } = useBusiness();
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.date === today && a.status !== 'cancelled');
  const upcoming = appointments.filter(a => a.date >= today && a.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
        <p className="text-muted-foreground">{business.name} · {business.industry}</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarDays} label="Afspraken vandaag" value={todayAppts.length} />
        <StatCard icon={TrendingUp} label="Totaal komend" value={upcoming.length} />
        <StatCard icon={Users} label="Medewerkers" value={employees.filter(e => e.active).length} />
        <StatCard icon={Scissors} label="Actieve diensten" value={services.filter(s => s.active).length} />
      </div>

      {/* Today */}
      <Card className="p-6">
        <h2 className="font-heading font-semibold text-lg mb-4">Afspraken vandaag</h2>
        {todayAppts.length === 0 ? (
          <p className="text-muted-foreground text-sm">Geen afspraken voor vandaag.</p>
        ) : (
          <div className="space-y-3">
            {todayAppts.map(apt => {
              const service = services.find(s => s.id === apt.serviceId);
              const employee = employees.find(e => e.id === apt.employeeId);
              return (
                <div key={apt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: service?.color || '#888' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{apt.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{service?.name} · {employee?.name}</p>
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <p className="font-medium">{apt.startTime} – {apt.endTime}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      apt.status === 'confirmed' ? 'bg-primary/10 text-primary' :
                      apt.status === 'pending' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>{apt.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent */}
      <Card className="p-6">
        <h2 className="font-heading font-semibold text-lg mb-4">Recente boekingen</h2>
        <div className="space-y-2">
          {appointments.slice(-5).reverse().map(apt => {
            const service = services.find(s => s.id === apt.serviceId);
            return (
              <div key={apt.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{apt.customer.name}</p>
                  <p className="text-xs text-muted-foreground">{service?.name}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{apt.date}</p>
                  <p>{apt.startTime}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-heading font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

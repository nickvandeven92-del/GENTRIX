import { Employee } from '@/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Props {
  employees: Employee[];
  onSelect: (employee: Employee) => void;
  selectedEmployeeId?: string | null;
}

export function EmployeeSelect({ employees, onSelect, selectedEmployeeId }: Props) {
  return (
    <div>
      <h2 className="text-2xl font-heading font-bold mb-2">Kies een medewerker</h2>
      <p className="text-muted-foreground mb-6">Bij wie wil je je afspraak maken?</p>
      <div className="grid gap-3">
        {employees.map(emp => (
          <Card
            key={emp.id}
            className={cn(
              'p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary/40 group',
              selectedEmployeeId === emp.id && 'border-primary ring-2 ring-primary/30',
            )}
            onClick={() => onSelect(emp)}
          >
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12 bg-accent">
                <AvatarFallback className="bg-accent text-accent-foreground font-heading font-bold">
                  {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-heading font-semibold group-hover:text-primary transition-colors">{emp.name}</h3>
                <p className="text-sm text-muted-foreground">{emp.role} · {emp.specialization}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

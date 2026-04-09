import { useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Maandag', tuesday: 'Dinsdag', wednesday: 'Woensdag', thursday: 'Donderdag',
  friday: 'Vrijdag', saturday: 'Zaterdag', sunday: 'Zondag',
};

export default function DashboardSchedules() {
  const { employees, updateEmployee } = useBusiness();
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const employee = employees.find(e => e.id === selectedEmpId);

  if (!employee) return <div className="p-6"><p className="text-muted-foreground">Geen medewerkers gevonden.</p></div>;

  const updateDay = (day: string, enabled: boolean) => {
    const schedule = { ...employee.schedule };
    schedule[day] = { ...schedule[day], enabled, blocks: enabled && schedule[day].blocks.length === 0 ? [{ start: '09:00', end: '17:00' }] : schedule[day].blocks };
    updateEmployee(employee.id, { schedule });
  };

  const updateBlock = (day: string, field: 'start' | 'end', value: string) => {
    const schedule = { ...employee.schedule };
    const blocks = [...schedule[day].blocks];
    blocks[0] = { ...blocks[0], [field]: value };
    schedule[day] = { ...schedule[day], blocks };
    updateEmployee(employee.id, { schedule });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Roosters</h1>
        <p className="text-muted-foreground text-sm">Werkdagen en -tijden per medewerker</p>
      </div>

      <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
        <SelectContent>
          {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Card className="p-6">
        <div className="space-y-4">
          {DAYS.map(day => {
            const d = employee.schedule[day];
            return (
              <div key={day} className="flex items-center gap-4 py-2 border-b last:border-0">
                <div className="w-28">
                  <span className="font-medium text-sm">{DAY_LABELS[day]}</span>
                </div>
                <Switch checked={d?.enabled || false} onCheckedChange={(v) => updateDay(day, v)} />
                {d?.enabled && d.blocks.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Input type="time" value={d.blocks[0].start} onChange={e => updateBlock(day, 'start', e.target.value)} className="w-28 h-8" />
                    <span className="text-muted-foreground">–</span>
                    <Input type="time" value={d.blocks[0].end} onChange={e => updateBlock(day, 'end', e.target.value)} className="w-28 h-8" />
                  </div>
                )}
                {(!d?.enabled) && <span className="text-sm text-muted-foreground">Vrij</span>}
              </div>
            );
          })}
        </div>
        <Button className="mt-4" onClick={() => toast.success('Rooster opgeslagen')}>Opslaan</Button>
      </Card>
    </div>
  );
}

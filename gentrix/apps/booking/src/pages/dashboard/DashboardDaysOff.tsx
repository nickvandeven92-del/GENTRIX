import { useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { DayOff } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { millisPrefixedId } from '@/lib/local-id';

export default function DashboardDaysOff() {
  const { employees, updateEmployee } = useBusiness();
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const employee = employees.find(e => e.id === selectedEmpId);

  if (!employee) return <div className="p-6"><p className="text-muted-foreground">Geen medewerkers.</p></div>;

  const addDayOff = () => {
    const today = new Date().toISOString().split('T')[0];
    const newOff: DayOff = { id: millisPrefixedId('off'), type: 'personal', startDate: today, endDate: today, reason: '' };
    updateEmployee(employee.id, { daysOff: [...employee.daysOff, newOff] });
  };

  const removeDayOff = (id: string) => {
    updateEmployee(employee.id, { daysOff: employee.daysOff.filter(d => d.id !== id) });
    toast.success('Vrije dag verwijderd');
  };

  const updateDayOff = (id: string, field: keyof DayOff, value: string) => {
    updateEmployee(employee.id, {
      daysOff: employee.daysOff.map(d => d.id === id ? { ...d, [field]: value } : d),
    });
  };

  const typeLabels: Record<string, string> = { vacation: 'Vakantie', sick: 'Ziekte', personal: 'Persoonlijk', blocked: 'Geblokkeerd' };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Vrije dagen</h1>
        <p className="text-muted-foreground text-sm">Vakantie, ziekte en afwezigheid</p>
      </div>

      <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
        <SelectContent>
          {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="space-y-3">
        {employee.daysOff.map(off => (
          <Card key={off.id} className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={off.type} onValueChange={(v) => updateDayOff(off.id, 'type', v)}>
                <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={off.startDate} onChange={e => updateDayOff(off.id, 'startDate', e.target.value)} className="w-40 h-8" />
              <span className="text-muted-foreground">t/m</span>
              <Input type="date" value={off.endDate} onChange={e => updateDayOff(off.id, 'endDate', e.target.value)} className="w-40 h-8" />
              <Input value={off.reason || ''} onChange={e => updateDayOff(off.id, 'reason', e.target.value)} placeholder="Reden" className="w-40 h-8" />
              <Button variant="ghost" size="icon" onClick={() => removeDayOff(off.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
        {employee.daysOff.length === 0 && <p className="text-muted-foreground text-sm">Geen vrije dagen ingepland.</p>}
      </div>

      <Button onClick={addDayOff} variant="outline"><Plus className="w-4 h-4 mr-1" /> Vrije dag toevoegen</Button>
    </div>
  );
}

import { useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { EmployeeBreak } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { millisPrefixedId } from '@/lib/local-id';

export default function DashboardBreaks() {
  const { employees, updateEmployee } = useBusiness();
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const employee = employees.find(e => e.id === selectedEmpId);

  if (!employee) return <div className="p-6"><p className="text-muted-foreground">Geen medewerkers.</p></div>;

  const addBreak = () => {
    const newBreak: EmployeeBreak = { id: millisPrefixedId('brk'), label: 'Nieuwe pauze', day: 'all', start: '12:00', end: '12:30' };
    updateEmployee(employee.id, { breaks: [...employee.breaks, newBreak] });
  };

  const removeBreak = (id: string) => {
    updateEmployee(employee.id, { breaks: employee.breaks.filter(b => b.id !== id) });
    toast.success('Pauze verwijderd');
  };

  const updateBreak = (id: string, field: keyof EmployeeBreak, value: string) => {
    updateEmployee(employee.id, {
      breaks: employee.breaks.map(b => b.id === id ? { ...b, [field]: value } : b),
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Pauzes</h1>
        <p className="text-muted-foreground text-sm">Beheer pauzes per medewerker</p>
      </div>

      <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
        <SelectContent>
          {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="space-y-3">
        {employee.breaks.map(brk => (
          <Card key={brk.id} className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Input value={brk.label} onChange={e => updateBreak(brk.id, 'label', e.target.value)} className="w-40 h-8" placeholder="Label" />
              <Input type="time" value={brk.start} onChange={e => updateBreak(brk.id, 'start', e.target.value)} className="w-28 h-8" />
              <span className="text-muted-foreground">–</span>
              <Input type="time" value={brk.end} onChange={e => updateBreak(brk.id, 'end', e.target.value)} className="w-28 h-8" />
              <Select value={brk.day} onValueChange={(v) => updateBreak(brk.id, 'day', v)}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle dagen</SelectItem>
                  <SelectItem value="monday">Maandag</SelectItem>
                  <SelectItem value="tuesday">Dinsdag</SelectItem>
                  <SelectItem value="wednesday">Woensdag</SelectItem>
                  <SelectItem value="thursday">Donderdag</SelectItem>
                  <SelectItem value="friday">Vrijdag</SelectItem>
                  <SelectItem value="saturday">Zaterdag</SelectItem>
                  <SelectItem value="sunday">Zondag</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeBreak(brk.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Button onClick={addBreak} variant="outline"><Plus className="w-4 h-4 mr-1" /> Pauze toevoegen</Button>
    </div>
  );
}

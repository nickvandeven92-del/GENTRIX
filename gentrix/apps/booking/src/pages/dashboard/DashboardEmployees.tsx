import { useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import type { Employee, Service, WeekSchedule } from '@/types';
import { millisPrefixedId } from '@/lib/local-id';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardEmployees() {
  const { employees, services, addEmployee, updateEmployee, deleteEmployee } = useBusiness();
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = () => { setEditingEmployee(null); setDialogOpen(true); };
  const openEdit = (emp: Employee) => { setEditingEmployee(emp); setDialogOpen(true); };

  const handleSave = (data: Partial<Employee>) => {
    if (editingEmployee) {
      updateEmployee(editingEmployee.id, data);
      toast.success('Medewerker bijgewerkt');
    } else {
      const defaultSchedule: WeekSchedule = {};
      (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const).forEach((d) => {
        defaultSchedule[d] = { enabled: true, blocks: [{ start: '09:00', end: '17:00' }] };
      });
      (['saturday', 'sunday'] as const).forEach((d) => {
        defaultSchedule[d] = { enabled: false, blocks: [] };
      });

      addEmployee({
        id: millisPrefixedId('emp'),
        businessId: employees[0]?.businessId || 'biz-1',
        schedule: defaultSchedule,
        breaks: [],
        daysOff: [],
        active: true,
        serviceIds: [],
        ...data,
      } as Employee);
      toast.success('Medewerker toegevoegd');
    }
    setDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Medewerkers</h1>
          <p className="text-muted-foreground text-sm">Beheer je team</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Toevoegen</Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {employees.map(emp => (
          <Card key={emp.id} className={`p-4 ${!emp.active ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-accent text-accent-foreground font-heading font-bold">
                  {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-semibold">{emp.name}</h3>
                <p className="text-sm text-muted-foreground">{emp.role}</p>
                <p className="text-xs text-muted-foreground">{emp.specialization}</p>
                <p className="text-xs text-muted-foreground mt-1">{emp.serviceIds.length} dienst(en)</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { deleteEmployee(emp.id); toast.success('Verwijderd'); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Medewerker bewerken' : 'Nieuwe medewerker'}</DialogTitle>
          </DialogHeader>
          <EmployeeForm employee={editingEmployee} services={services} onSave={handleSave} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeForm({
  employee,
  services,
  onSave,
}: {
  employee: Employee | null;
  services: Service[];
  onSave: (data: Partial<Employee>) => void;
}) {
  const [name, setName] = useState(employee?.name || '');
  const [role, setRole] = useState(employee?.role || '');
  const [specialization, setSpecialization] = useState(employee?.specialization || '');
  const [selectedServices, setSelectedServices] = useState<string[]>(employee?.serviceIds || []);

  const toggleService = (id: string) => {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), role: role.trim(), specialization: specialization.trim(), serviceIds: selectedServices });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Naam</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
      <div><Label>Functie</Label><Input value={role} onChange={e => setRole(e.target.value)} placeholder="Bijv. Stylist" /></div>
      <div><Label>Specialisatie</Label><Input value={specialization} onChange={e => setSpecialization(e.target.value)} placeholder="Bijv. Heren & Baard" /></div>
      <div>
        <Label className="mb-2 block">Diensten</Label>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {services.filter(s => s.active).map(s => (
            <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={selectedServices.includes(s.id)} onCheckedChange={() => toggleService(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full">Opslaan</Button>
    </form>
  );
}

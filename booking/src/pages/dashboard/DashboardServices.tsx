import { useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { Service } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Clock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardServices() {
  const { services, employees, business, addService, updateService, deleteService, updateSettings } = useBusiness();
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = () => {
    setEditingService(null);
    setDialogOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setDialogOpen(true);
  };

  const handleSave = (data: Partial<Service>) => {
    if (editingService) {
      updateService(editingService.id, data);
      toast.success('Dienst bijgewerkt');
    } else {
      addService({
        id: `srv-${Date.now()}`,
        businessId: services[0]?.businessId || 'biz-1',
        employeeIds: [],
        active: true,
        ...data,
      } as Service);
      toast.success('Dienst aangemaakt');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteService(id);
    toast.success('Dienst verwijderd');
  };

  const toggleServicesPage = (checked: boolean) => {
    updateSettings({ showServicesPage: checked });
    toast.success(checked ? 'Dienstenpagina zichtbaar op website' : 'Dienstenpagina verborgen op website');
  };

  const showOnWebsite = business.settings.showServicesPage;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Diensten</h1>
          <p className="text-muted-foreground text-sm">Beheer je diensten en afspraaktypes</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nieuwe dienst</Button>
      </div>

      <Card className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showOnWebsite ? <Eye className="w-5 h-5 text-primary" /> : <EyeOff className="w-5 h-5 text-muted-foreground" />}
          <div>
            <h3 className="font-heading font-semibold">Dienstenpagina op website</h3>
            <p className="text-sm text-muted-foreground">Toon de dienstenpagina met prijzen en beschrijvingen op je website</p>
          </div>
        </div>
        <Switch
          checked={showOnWebsite}
          onCheckedChange={toggleServicesPage}
        />
      </Card>

      <div className="grid gap-3">
        {services.map(service => (
          <Card key={service.id} className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: service.color }} />
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-semibold">{service.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{service.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <Clock className="w-3 h-3 inline mr-1" />{service.duration} min
                  {service.price !== null && service.price > 0 && ` · €${service.price.toFixed(2)}`}
                  {` · ${employees.filter(e => e.serviceIds.includes(service.id)).length} medewerker(s)`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(service)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Dienst bewerken' : 'Nieuwe dienst'}</DialogTitle>
          </DialogHeader>
          <ServiceForm service={editingService} onSave={handleSave} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceForm({ service, onSave }: { service: Service | null; onSave: (data: Partial<Service>) => void }) {
  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [duration, setDuration] = useState(service?.duration?.toString() || '30');
  const [price, setPrice] = useState(service?.price?.toString() || '');
  const [color, setColor] = useState(service?.color || '#0d9488');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      duration: parseInt(duration) || 30,
      price: price ? parseFloat(price) : null,
      color,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Naam</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Naam van de dienst" required />
      </div>
      <div>
        <Label>Beschrijving</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Korte beschrijving" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Duur (minuten)</Label>
          <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="5" step="5" />
        </div>
        <div>
          <Label>Prijs (€)</Label>
          <Input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.50" placeholder="Optioneel" />
        </div>
      </div>
      <div>
        <Label>Kleur</Label>
        <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 p-1" />
      </div>
      <Button type="submit" className="w-full">Opslaan</Button>
    </form>
  );
}

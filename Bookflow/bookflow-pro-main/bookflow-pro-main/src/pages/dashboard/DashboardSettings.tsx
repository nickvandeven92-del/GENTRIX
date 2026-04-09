import { useBusiness } from '@/context/BusinessContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useState } from 'react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Maandag', tuesday: 'Dinsdag', wednesday: 'Woensdag', thursday: 'Donderdag',
  friday: 'Vrijdag', saturday: 'Zaterdag', sunday: 'Zondag',
};

export default function DashboardSettings() {
  const { business, updateSettings } = useBusiness();
  const s = business.settings;

  const [slotInterval, setSlotInterval] = useState(s.slotInterval.toString());
  const [bufferTime, setBufferTime] = useState(s.bufferTime.toString());
  const [maxAdvance, setMaxAdvance] = useState(s.maxAdvanceBookingDays.toString());
  const [minCancel, setMinCancel] = useState(s.minCancelHours.toString());

  const save = () => {
    updateSettings({
      slotInterval: parseInt(slotInterval) || 15,
      bufferTime: parseInt(bufferTime) || 0,
      maxAdvanceBookingDays: parseInt(maxAdvance) || 30,
      minCancelHours: parseInt(minCancel) || 24,
    });
    toast.success('Instellingen opgeslagen');
  };

  const updateOpeningDay = (day: string, enabled: boolean) => {
    const oh = { ...s.openingHours };
    oh[day] = { ...oh[day], enabled, blocks: enabled && oh[day].blocks.length === 0 ? [{ start: '09:00', end: '17:00' }] : oh[day].blocks };
    updateSettings({ openingHours: oh });
  };

  const updateOpeningTime = (day: string, field: 'start' | 'end', value: string) => {
    const oh = { ...s.openingHours };
    const blocks = [...oh[day].blocks];
    blocks[0] = { ...blocks[0], [field]: value };
    oh[day] = { ...oh[day], blocks };
    updateSettings({ openingHours: oh });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-bold">Instellingen</h1>
        <p className="text-muted-foreground text-sm">Bedrijfsinstellingen en boekingsregels</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="font-heading font-semibold">Bedrijfsgegevens</h2>
        <div><Label>Bedrijfsnaam</Label><Input value={business.name} disabled /></div>
        <div><Label>Branche</Label><Input value={business.industry} disabled /></div>
        <div><Label>E-mail</Label><Input value={business.email} disabled /></div>
        <div><Label>Telefoon</Label><Input value={business.phone} disabled /></div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-heading font-semibold">Boekingsregels</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Tijdslot interval (min)</Label>
            <Select value={slotInterval} onValueChange={setSlotInterval}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minuten</SelectItem>
                <SelectItem value="30">30 minuten</SelectItem>
                <SelectItem value="60">60 minuten</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Buffer tussen afspraken (min)</Label>
            <Input type="number" value={bufferTime} onChange={e => setBufferTime(e.target.value)} min="0" step="5" />
          </div>
          <div>
            <Label>Max. vooruit boeken (dagen)</Label>
            <Input type="number" value={maxAdvance} onChange={e => setMaxAdvance(e.target.value)} min="1" />
          </div>
          <div>
            <Label>Min. annuleertijd (uren)</Label>
            <Input type="number" value={minCancel} onChange={e => setMinCancel(e.target.value)} min="0" />
          </div>
        </div>
        <Button onClick={save}>Opslaan</Button>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-heading font-semibold">Openingstijden</h2>
        {DAYS.map(day => {
          const d = s.openingHours[day];
          return (
            <div key={day} className="flex items-center gap-4 py-2 border-b last:border-0">
              <div className="w-28"><span className="font-medium text-sm">{DAY_LABELS[day]}</span></div>
              <Switch checked={d?.enabled || false} onCheckedChange={(v) => updateOpeningDay(day, v)} />
              {d?.enabled && d.blocks.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Input type="time" value={d.blocks[0].start} onChange={e => updateOpeningTime(day, 'start', e.target.value)} className="w-28 h-8" />
                  <span className="text-muted-foreground">–</span>
                  <Input type="time" value={d.blocks[0].end} onChange={e => updateOpeningTime(day, 'end', e.target.value)} className="w-28 h-8" />
                </div>
              )}
              {!d?.enabled && <span className="text-sm text-muted-foreground">Gesloten</span>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

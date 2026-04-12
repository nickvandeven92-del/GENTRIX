import { useState } from 'react';
import { useWebshop } from '@/webshop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Tag } from 'lucide-react';
import type { DiscountCode, DiscountType } from '../types';

export default function DashboardDiscounts() {
  const { state, addDiscountCode, deleteDiscountCode, toggleDiscountActive } = useWebshop();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '', type: 'percentage' as DiscountType, value: '',
    minOrderAmount: '', maxUses: '', validUntil: '',
  });

  const handleAdd = () => {
    if (!form.code || !form.value) return;
    const dc: DiscountCode = {
      id: `dc-${Date.now()}`,
      code: form.code.toUpperCase(),
      type: form.type,
      value: parseFloat(form.value),
      minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      usedCount: 0,
      active: true,
      validUntil: form.validUntil || undefined,
      createdAt: new Date().toISOString(),
    };
    addDiscountCode(dc);
    setForm({ code: '', type: 'percentage', value: '', minOrderAmount: '', maxUses: '', validUntil: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kortingscodes</h1>
          <p className="text-muted-foreground">{state.discountCodes.length} code(s)</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> Nieuwe code
        </Button>
      </div>

      {showForm && (
        <div className="border border-border rounded-lg p-6 bg-card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Code</Label>
              <Input placeholder="bijv. KORTING10" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v: DiscountType) => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Vast bedrag (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Waarde</Label>
              <Input type="number" placeholder={form.type === 'percentage' ? '10' : '5.00'} value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
            </div>
            <div>
              <Label>Min. bestelbedrag (optioneel)</Label>
              <Input type="number" placeholder="25.00" value={form.minOrderAmount} onChange={e => setForm(p => ({ ...p, minOrderAmount: e.target.value }))} />
            </div>
            <div>
              <Label>Max. gebruik (optioneel)</Label>
              <Input type="number" placeholder="100" value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))} />
            </div>
            <div>
              <Label>Geldig tot (optioneel)</Label>
              <Input type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd}>Toevoegen</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuleren</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium text-muted-foreground">Code</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Waarde</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Gebruik</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Acties</th>
            </tr>
          </thead>
          <tbody>
            {state.discountCodes.map(dc => (
              <tr key={dc.id} className="border-t border-border">
                <td className="p-3 font-mono font-medium text-foreground flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" /> {dc.code}
                </td>
                <td className="p-3 text-muted-foreground">{dc.type === 'percentage' ? 'Percentage' : 'Vast bedrag'}</td>
                <td className="p-3 text-foreground">{dc.type === 'percentage' ? `${dc.value}%` : `€${dc.value.toFixed(2)}`}</td>
                <td className="p-3 text-muted-foreground">{dc.usedCount}{dc.maxUses ? ` / ${dc.maxUses}` : ''}</td>
                <td className="p-3">
                  <Switch checked={dc.active} onCheckedChange={() => toggleDiscountActive(dc.id)} />
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteDiscountCode(dc.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {state.discountCodes.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Geen kortingscodes aangemaakt</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

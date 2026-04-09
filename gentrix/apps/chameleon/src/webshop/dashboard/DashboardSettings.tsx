import { useWebshop } from '@/webshop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { useState } from 'react';
import type { WebshopConfig } from '@/webshop/types';

export default function DashboardSettings() {
  const { state, updateConfig } = useWebshop();
  const [form, setForm] = useState<WebshopConfig>(state.config);

  const handleSave = () => updateConfig(form);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Instellingen</h1>
        <p className="text-muted-foreground">Webshop configuratie</p>
      </div>

      <div className="border border-border rounded-lg p-6 bg-card space-y-6">

        <div className="border-t border-border pt-6 space-y-4">
          <h2 className="font-semibold text-card-foreground">Algemeen</h2>
          <div>
            <Label>Shopnaam</Label>
            <Input value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Beschrijving</Label>
            <Input value={form.shopDescription || ''} onChange={e => setForm({ ...form, shopDescription: e.target.value })} className="mt-1" />
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <h2 className="font-semibold text-card-foreground">Valuta & BTW</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valuta</Label>
              <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Valutasymbool</Label>
              <Input value={form.currencySymbol} onChange={e => setForm({ ...form, currencySymbol: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>BTW-tarief (%)</Label>
            <Input type="number" step="0.01" value={(form.taxRate * 100).toFixed(0)} onChange={e => setForm({ ...form, taxRate: (parseFloat(e.target.value) || 0) / 100 })} className="mt-1 w-32" />
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <h2 className="font-semibold text-card-foreground">Verzending</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Verzendkosten (€)</Label>
              <Input type="number" step="0.01" value={form.shippingCost ?? ''} onChange={e => setForm({ ...form, shippingCost: parseFloat(e.target.value) || 0 })} className="mt-1" />
            </div>
            <div>
              <Label>Gratis verzending vanaf (€)</Label>
              <Input type="number" step="0.01" value={form.freeShippingThreshold ?? ''} onChange={e => setForm({ ...form, freeShippingThreshold: parseFloat(e.target.value) || undefined })} className="mt-1" />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full"><Save className="h-4 w-4 mr-2" /> Instellingen opslaan</Button>
      </div>
    </div>
  );
}

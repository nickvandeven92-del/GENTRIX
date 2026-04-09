import { useState } from 'react';
import { useWebshop } from '../context/WebshopContext';
import { DiscountCodeInput } from './DiscountCodeInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CheckoutData } from '../types';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

export function CheckoutForm() {
  const { state, formatPrice, placeOrder } = useWebshop();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CheckoutData>({
    email: '', firstName: '', lastName: '', address: '', city: '', postalCode: '', country: 'NL', phone: '', notes: '',
  });

  const update = (field: keyof CheckoutData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await placeOrder(form);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? 'Bestellen mislukt');
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Bestelling ontvangen!</h2>
        <p className="text-muted-foreground">Bedankt voor je bestelling. Je ontvangt een bevestiging per e-mail.</p>
      </div>
    );
  }

  if (state.cart.items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Je winkelwagen is leeg.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Contactgegevens</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">E-mailadres</Label>
              <Input id="email" type="email" required value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Voornaam</Label>
                <Input id="firstName" required value={form.firstName} onChange={e => update('firstName', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="lastName">Achternaam</Label>
                <Input id="lastName" required value={form.lastName} onChange={e => update('lastName', e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Telefoonnummer</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Verzendadres</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="address">Adres</Label>
              <Input id="address" required value={form.address} onChange={e => update('address', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postalCode">Postcode</Label>
                <Input id="postalCode" required value={form.postalCode} onChange={e => update('postalCode', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="city">Plaats</Label>
                <Input id="city" required value={form.city} onChange={e => update('city', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Opmerkingen (optioneel)</Label>
          <Textarea id="notes" value={form.notes} onChange={e => update('notes', e.target.value)} />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Bezig…' : `Bestelling plaatsen — ${formatPrice(state.cart.total)}`}
        </Button>
      </form>

      {/* Order summary */}
      <div className="lg:col-span-1">
        <div className="border border-border rounded-lg p-6 space-y-4 sticky top-4 bg-card">
          <h3 className="font-semibold text-card-foreground">Overzicht</h3>
          {state.cart.items.map(item => (
            <div key={item.variantId} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.product.name} × {item.quantity}
              </span>
              <span className="text-card-foreground font-medium">
                {formatPrice(item.variant.price * item.quantity)}
              </span>
            </div>
          ))}

          {/* Discount code */}
          <div className="border-t border-border pt-3">
            <DiscountCodeInput />
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotaal</span><span>{formatPrice(state.cart.subtotal)}</span>
            </div>
            {state.cart.discount > 0 && (
              <div className="flex justify-between text-sm text-primary">
                <span>Korting</span><span>-{formatPrice(state.cart.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>BTW</span><span>{formatPrice(state.cart.tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-card-foreground text-lg">
              <span>Totaal</span><span>{formatPrice(state.cart.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

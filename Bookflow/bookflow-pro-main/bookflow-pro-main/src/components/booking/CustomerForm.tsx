import { useState } from 'react';
import { CustomerInfo } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

interface Props {
  onSubmit: (info: CustomerInfo) => void;
  initialData?: CustomerInfo | null;
}

export function CustomerForm({ onSubmit, initialData }: Props) {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Naam is verplicht';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Geldig e-mailadres is verplicht';
    if (!phone.trim() || phone.trim().length < 8) e.phone = 'Geldig telefoonnummer is verplicht';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), notes: notes.trim() || undefined });
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-heading font-bold mb-2">Jouw gegevens</h2>
      <p className="text-muted-foreground mb-6">Vul je contactgegevens in zodat we je afspraak kunnen bevestigen.</p>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Naam *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Je volledige naam" />
            {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="je@email.nl" />
            {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label htmlFor="phone">Telefoon *</Label>
            <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06-12345678" />
            {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone}</p>}
          </div>
          <div>
            <Label htmlFor="notes">Opmerking (optioneel)</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Extra opmerkingen..." rows={3} />
          </div>
          <Button type="submit" className="w-full">Verder</Button>
        </form>
      </Card>
    </div>
  );
}

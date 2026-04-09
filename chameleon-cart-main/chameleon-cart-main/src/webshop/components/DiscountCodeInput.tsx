import { useState } from 'react';
import { useWebshop } from '../context/WebshopContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, X, Check } from 'lucide-react';

export function DiscountCodeInput() {
  const { state, applyDiscount, removeDiscount, formatPrice } = useWebshop();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleApply = () => {
    setError('');
    const result = applyDiscount(code.trim().toUpperCase());
    if (!result.valid) {
      setError(result.reason || 'Ongeldige code');
    } else {
      setCode('');
    }
  };

  if (state.cart.discountCode) {
    return (
      <div className="flex items-center justify-between p-3 rounded-md border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{state.cart.discountCode}</span>
          <Check className="h-4 w-4 text-primary" />
          <span className="text-sm text-primary">-{formatPrice(state.cart.discount)}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={removeDiscount}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Kortingscode"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleApply()}
          className="flex-1"
        />
        <Button variant="outline" onClick={handleApply} disabled={!code.trim()}>
          Toepassen
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

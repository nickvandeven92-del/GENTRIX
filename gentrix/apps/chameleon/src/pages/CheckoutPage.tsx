import { CheckoutForm, useWebshop } from '@/webshop';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function CheckoutPage() {
  const { shopBasePath } = useWebshop();
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Link to={shopBasePath} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Terug naar shop
      </Link>
      <h1 className="text-3xl font-bold text-foreground">Afrekenen</h1>
      <CheckoutForm />
    </div>
  );
}

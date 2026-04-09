import { Link } from 'react-router-dom';
import { ProductGrid, CartButton, useWebshop } from '@/webshop';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ArrowRight, Settings, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { state, shopBasePath, dataLoading, shopUnavailable } = useWebshop();
  const featured = state.products.filter(p => p.active).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      {/* Simple nav showing cart integration */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold text-foreground">Kameleon</Link>
          <nav className="flex items-center gap-6">
            <Link to={shopBasePath} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Shop</Link>
            <Link to={`${shopBasePath}/wishlist`} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> Verlanglijst
            </Link>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Inloggen
            </Link>
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <Settings className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <CartButton />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center space-y-6">
        <h1 className="text-5xl md:text-6xl font-bold text-foreground tracking-tight">
          Webshop Module
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Een universele webshop-engine die zich automatisch aanpast aan elke website.
          Geen eigen branding — puur kameleon.
        </p>
        <Button size="lg" asChild>
          <Link to={shopBasePath} className="inline-flex items-center gap-2">
            Bekijk de shop <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* Featured products */}
      <section className="container mx-auto px-4 py-16 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Uitgelicht</h2>
          <Link to={shopBasePath} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            Alle producten <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {!isSupabaseConfigured ? (
          <p className="text-muted-foreground text-center py-8">
            Voeg <code className="text-foreground">VITE_SUPABASE_URL</code> en{' '}
            <code className="text-foreground">VITE_SUPABASE_ANON_KEY</code> toe aan je{' '}
            <code className="text-foreground">.env</code> om producten te laden.
          </p>
        ) : shopUnavailable ? (
          <p className="text-muted-foreground text-center py-8">
            Deze webshop is nog niet actief. Neem contact op met de beheerder.
          </p>
        ) : dataLoading ? (
          <p className="text-muted-foreground text-center py-8">Laden…</p>
        ) : (
          <ProductGrid products={featured} columns={3} />
        )}
      </section>
    </div>
  );
};

export default Index;

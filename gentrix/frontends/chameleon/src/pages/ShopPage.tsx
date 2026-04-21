import { useState } from 'react';
import { ProductGrid, ProductFilters, SearchBar, useWebshop } from '@/webshop';

function ShopSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="h-4 w-72 rounded bg-muted" />
      </div>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 w-20 rounded-full bg-muted" />
          ))}
        </div>
        <div className="h-9 w-full sm:w-72 rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border overflow-hidden bg-card">
            <div className="aspect-square bg-muted" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-5 w-1/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { state, getProductsByCategory, dataLoading, shopUnavailable } = useWebshop();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const simple = state.config.simpleMode;

  if (shopUnavailable) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Deze webshop is niet actief of bestaat niet.
      </div>
    );
  }

  if (dataLoading) {
    return <ShopSkeleton />;
  }

  const products = selectedCategory
    ? getProductsByCategory(selectedCategory).filter(p => p.active)
    : state.products.filter(p => p.active);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">{state.config.shopName}</h1>
        {state.config.shopDescription && (
          <p className="text-muted-foreground">{state.config.shopDescription}</p>
        )}
      </div>

      {!simple && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <ProductFilters selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />
          <div className="w-full sm:w-72">
            <SearchBar />
          </div>
        </div>
      )}

      <ProductGrid products={products} columns={simple ? 2 : 3} />
    </div>
  );
}

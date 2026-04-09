import { useState } from 'react';
import { ProductGrid, ProductFilters, SearchBar, useWebshop } from '@/webshop';

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
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Shop laden…
      </div>
    );
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

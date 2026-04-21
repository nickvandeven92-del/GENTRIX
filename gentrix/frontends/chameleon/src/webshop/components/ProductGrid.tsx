import { useWebshop } from '../context/WebshopContext';
import type { Product } from '../types';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products?: Product[];
  categoryId?: string;
  columns?: 2 | 3 | 4;
}

export function ProductGrid({ products: propProducts, categoryId, columns = 3 }: ProductGridProps) {
  const { state, getProductsByCategory } = useWebshop();

  const products = propProducts
    ?? (categoryId ? getProductsByCategory(categoryId) : state.products.filter(p => p.active));

  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  };

  if (products.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Geen producten gevonden.
      </div>
    );
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-6`}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} eager={index < columns * 2} />
      ))}
    </div>
  );
}

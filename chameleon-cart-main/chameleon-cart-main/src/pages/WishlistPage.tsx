import { Link } from 'react-router-dom';
import { useWebshop, ProductGrid } from '@/webshop';
import { Heart } from 'lucide-react';

export default function WishlistPage() {
  const { state, shopBasePath } = useWebshop();
  const wishlistProducts = state.wishlist
    .map(w => state.products.find(p => p.id === w.productId))
    .filter(Boolean) as typeof state.products;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Heart className="h-7 w-7" /> Verlanglijst
        </h1>
        <p className="text-muted-foreground">
          {wishlistProducts.length === 0
            ? 'Je verlanglijst is leeg.'
            : `${wishlistProducts.length} product${wishlistProducts.length !== 1 ? 'en' : ''} in je verlanglijst`}
        </p>
      </div>

      {wishlistProducts.length > 0 ? (
        <ProductGrid products={wishlistProducts} />
      ) : (
        <div className="text-center py-16">
          <Link to={shopBasePath} className="text-primary hover:underline">
            Bekijk onze producten
          </Link>
        </div>
      )}
    </div>
  );
}

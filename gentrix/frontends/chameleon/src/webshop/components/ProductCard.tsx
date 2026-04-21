import { Link } from 'react-router-dom';
import { useWebshop } from '../context/WebshopContext';
import type { Product } from '../types';
import { Badge } from '@/components/ui/badge';
import { WishlistButton } from './WishlistButton';
import { StarRating } from './StarRating';
import { getAverageRating } from '../types';

interface ProductCardProps {
  product: Product;
  /** Pass true for above-the-fold cards to load eagerly */
  eager?: boolean;
}

export function ProductCard({ product, eager = false }: ProductCardProps) {
  const { formatPrice, getProductReviews, state, shopBasePath } = useWebshop();
  const simple = state.config.simpleMode;
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.basePrice;
  const reviews = getProductReviews(product.id).filter(r => r.approved);
  const avgRating = getAverageRating(reviews);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-lg">
      {!simple && (
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton productId={product.id} />
        </div>
      )}
      <Link to={`${shopBasePath}/product/${product.slug}`} className="block">
        <div className="aspect-square overflow-hidden bg-muted animate-pulse [&:has(img.loaded)]:animate-none">
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading={eager ? 'eager' : 'lazy'}
            onLoad={e => (e.currentTarget.classList.add('loaded'))}
          />
        </div>
        <div className="p-4 space-y-2">
          {!simple && product.shortDescription && (
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {product.shortDescription}
            </p>
          )}
          <h3 className="font-semibold text-card-foreground leading-tight">{product.name}</h3>

          {!simple && reviews.length > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRating rating={avgRating} size="sm" />
              <span className="text-xs text-muted-foreground">({reviews.length})</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">{formatPrice(product.basePrice)}</span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice!)}
              </span>
            )}
            {hasDiscount && (
              <Badge variant="destructive" className="text-xs">Sale</Badge>
            )}
          </div>
          {!simple && product.totalStock <= 5 && product.totalStock > 0 && (
            <p className="text-xs text-destructive">Nog maar {product.totalStock} op voorraad</p>
          )}
        </div>
      </Link>
    </div>
  );
}

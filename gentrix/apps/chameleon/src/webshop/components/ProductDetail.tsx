import { useState, useMemo } from 'react';
import { useWebshop } from '../context/WebshopContext';
import type { Product, ProductVariant } from '../types';
import { AddToCartButton } from './AddToCartButton';
import { WishlistButton } from './WishlistButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

interface ProductDetailProps {
  product: Product;
}

export function ProductDetail({ product }: ProductDetailProps) {
  const { formatPrice, state } = useWebshop();
  const simple = state.config.simpleMode;
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    product.variantOptions.forEach(opt => {
      initial[opt.name] = opt.values[0];
    });
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const selectedVariant: ProductVariant | undefined = useMemo(() => {
    return product.variants.find(v =>
      Object.entries(selectedOptions).every(([key, val]) => v.options[key] === val)
    );
  }, [product.variants, selectedOptions]);

  const price = selectedVariant?.price ?? product.basePrice;
  const compareAt = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const inStock = (selectedVariant?.stock ?? 0) > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
      {/* Images */}
      <div className="space-y-4">
        <div className="aspect-square overflow-hidden rounded-lg bg-muted">
          <img src={product.images[activeImage]} alt={product.name} className="h-full w-full object-cover" />
        </div>
        {product.images.length > 1 && (
          <div className="flex gap-2">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                  i === activeImage ? 'border-primary' : 'border-border'
                }`}
              >
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-6">
        <div>
          {!simple && product.shortDescription && (
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">{product.shortDescription}</p>
          )}
          <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-foreground">{formatPrice(price)}</span>
          {compareAt && compareAt > price && (
            <>
              <span className="text-lg text-muted-foreground line-through">{formatPrice(compareAt)}</span>
              <Badge variant="destructive">-{Math.round((1 - price / compareAt) * 100)}%</Badge>
            </>
          )}
        </div>

        {/* Variant options */}
        <div className="space-y-4">
          {product.variantOptions.map(option => (
            <div key={option.name}>
              <label className="block text-sm font-medium text-foreground mb-2">
                {option.name}: <span className="text-muted-foreground">{selectedOptions[option.name]}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {option.values.map(value => (
                  <button
                    key={value}
                    onClick={() => setSelectedOptions(prev => ({ ...prev, [option.name]: value }))}
                    className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                      selectedOptions[option.name] === value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:border-primary'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Aantal</label>
          <div className="inline-flex items-center border border-border rounded-md">
            <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-foreground font-medium">{quantity}</span>
            <Button variant="ghost" size="icon" onClick={() => setQuantity(q => q + 1)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {selectedVariant && (
            <div className="flex-1">
              <AddToCartButton product={product} variant={selectedVariant} quantity={quantity} disabled={!inStock} />
            </div>
          )}
          {!simple && <WishlistButton productId={product.id} variant="full" />}
        </div>

        {!inStock && <p className="text-destructive font-medium">Uitverkocht</p>}

        {/* Description */}
        <div className="border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Beschrijving</h2>
          <p className="text-muted-foreground leading-relaxed">{product.description}</p>
        </div>
      </div>
    </div>
  );
}

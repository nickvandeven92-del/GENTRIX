import { useParams, Link } from 'react-router-dom';
import { ProductDetail, ProductSEO, ReviewList, ReviewForm, useWebshop } from '@/webshop';
import { ArrowLeft } from 'lucide-react';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { getProduct, state, shopBasePath, dataLoading } = useWebshop();
  const product = slug ? getProduct(slug) : undefined;
  const simple = state.config.simpleMode;

  if (dataLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Product laden…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">Product niet gevonden</h1>
        <Link to={shopBasePath} className="text-primary hover:underline">Terug naar shop</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-10">
      <ProductSEO product={product} />
      <Link to={shopBasePath} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Terug naar shop
      </Link>
      <ProductDetail product={product} />

      {/* Reviews section — hidden in simple mode */}
      {!simple && (
        <div className="border-t border-border pt-10 space-y-8">
          <h2 className="text-2xl font-bold text-foreground">Beoordelingen</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ReviewList productId={product.id} />
            <ReviewForm productId={product.id} />
          </div>
        </div>
      )}
    </div>
  );
}

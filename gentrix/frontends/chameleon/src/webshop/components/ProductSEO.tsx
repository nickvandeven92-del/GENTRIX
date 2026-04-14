import { Helmet } from 'react-helmet-async';
import type { Product } from '../types';
import { useWebshop } from '../context/WebshopContext';
import { getAverageRating } from '../types';

interface ProductSEOProps {
  product: Product;
}

export function ProductSEO({ product }: ProductSEOProps) {
  const { state, getProductReviews, shopBasePath } = useWebshop();
  const reviews = getProductReviews(product.id).filter(r => r.approved);
  const avgRating = getAverageRating(reviews);

  const title = product.metaTitle || `${product.name} | ${state.config.shopName}`;
  const description = product.metaDescription || product.shortDescription || product.description.slice(0, 155);
  const image = product.ogImage || product.images[0];
  const url = `${window.location.origin}${shopBasePath}/product/${product.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.variants[0]?.sku,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: state.config.currency,
      lowPrice: Math.min(...product.variants.map(v => v.price)),
      highPrice: Math.max(...product.variants.map(v => v.price)),
      offerCount: product.variants.length,
      availability: product.totalStock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    ...(reviews.length > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: avgRating.toFixed(1),
        reviewCount: reviews.length,
      },
    }),
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content="product" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="product:price:amount" content={String(product.basePrice)} />
      <meta property="product:price:currency" content={state.config.currency} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD */}
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}

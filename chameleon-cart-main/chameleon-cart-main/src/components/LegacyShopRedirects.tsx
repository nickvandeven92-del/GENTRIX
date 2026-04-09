import { Navigate, useParams } from 'react-router-dom';

const defaultSlug = import.meta.env.VITE_DEFAULT_CLIENT_SLUG ?? 'demo-kapper';

export function LegacyProductRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/shop/c/${defaultSlug}/product/${slug ?? ''}`} replace />;
}

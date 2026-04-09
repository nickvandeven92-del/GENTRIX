import { useWebshop } from '../context/WebshopContext';
import { StarRating } from './StarRating';
import { getAverageRating } from '../types';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface ReviewListProps {
  productId: string;
}

export function ReviewList({ productId }: ReviewListProps) {
  const { getProductReviews } = useWebshop();
  const reviews = getProductReviews(productId);
  const approved = reviews.filter(r => r.approved);
  const avg = getAverageRating(approved);

  if (approved.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Nog geen beoordelingen voor dit product.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold text-foreground">{avg.toFixed(1)}</div>
        <div>
          <StarRating rating={avg} />
          <p className="text-sm text-muted-foreground">{approved.length} beoordeling{approved.length !== 1 ? 'en' : ''}</p>
        </div>
      </div>

      {/* Reviews */}
      <div className="space-y-4">
        {approved.map(review => (
          <div key={review.id} className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StarRating rating={review.rating} size="sm" />
                {review.verified && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <CheckCircle className="h-3 w-3" /> Geverifieerd
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString('nl-NL')}
              </span>
            </div>
            <h4 className="font-medium text-foreground">{review.title}</h4>
            <p className="text-sm text-muted-foreground">{review.body}</p>
            <p className="text-xs text-muted-foreground">— {review.author}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

const sizes = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-6 w-6' };

export function StarRating({ rating, max = 5, size = 'md', interactive = false, onChange }: StarRatingProps) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(rating);
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i + 1)}
            className={cn(
              'transition-colors',
              interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default',
            )}
          >
            <Star
              className={cn(
                sizes[size],
                filled
                  ? 'fill-primary text-primary'
                  : 'fill-muted text-muted-foreground/30'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

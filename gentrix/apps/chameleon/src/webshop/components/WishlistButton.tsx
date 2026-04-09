import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebshop } from '../context/WebshopContext';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  productId: string;
  variant?: 'icon' | 'full';
}

export function WishlistButton({ productId, variant = 'icon' }: WishlistButtonProps) {
  const { isInWishlist, toggleWishlist } = useWebshop();
  const inWishlist = isInWishlist(productId);

  if (variant === 'full') {
    return (
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => toggleWishlist(productId)}
      >
        <Heart className={cn('h-4 w-4', inWishlist && 'fill-destructive text-destructive')} />
        {inWishlist ? 'In verlanglijst' : 'Toevoegen aan verlanglijst'}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWishlist(productId); }}
    >
      <Heart className={cn('h-4 w-4 transition-colors', inWishlist ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
    </Button>
  );
}

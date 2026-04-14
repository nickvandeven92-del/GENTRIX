import { useState } from 'react';
import { useWebshop } from '../context/WebshopContext';
import type { Product, ProductVariant } from '../types';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddToCartButtonProps {
  product: Product;
  variant: ProductVariant;
  quantity?: number;
  disabled?: boolean;
  compact?: boolean;
}

export function AddToCartButton({ product, variant, quantity = 1, disabled, compact }: AddToCartButtonProps) {
  const { addToCart } = useWebshop();
  const [added, setAdded] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    addToCart(product, variant, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled}
      size={compact ? 'sm' : 'lg'}
      className="w-full relative overflow-hidden"
    >
      <AnimatePresence mode="wait">
        {added ? (
          <motion.span
            key="added"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" /> Toegevoegd!
          </motion.span>
        ) : (
          <motion.span
            key="add"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex items-center gap-2"
          >
            <ShoppingCart className="h-4 w-4" /> {compact ? 'Toevoegen' : 'In winkelwagen'}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}

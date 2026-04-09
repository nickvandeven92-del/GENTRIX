import { useWebshop } from '../context/WebshopContext';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export function CartButton() {
  const { toggleCart, cartItemCount } = useWebshop();

  return (
    <Button variant="ghost" size="icon" className="relative" onClick={() => toggleCart()}>
      <ShoppingBag className="h-5 w-5" />
      <AnimatePresence>
        {cartItemCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold"
          >
            {cartItemCount}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}

import { useWebshop } from '../context/WebshopContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export function CartDrawer() {
  const { state, toggleCart, removeFromCart, updateQuantity, formatPrice, cartItemCount, shopBasePath } = useWebshop();

  return (
    <Sheet open={state.isCartOpen} onOpenChange={(open) => toggleCart(open)}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Winkelwagen ({cartItemCount})
          </SheetTitle>
        </SheetHeader>

        {state.cart.items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Je winkelwagen is leeg</p>
              <Button variant="outline" onClick={() => toggleCart(false)} asChild>
                <Link to={shopBasePath}>Verder winkelen</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              <AnimatePresence>
                {state.cart.items.map(item => (
                  <motion.div
                    key={item.variantId}
                    layout
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="flex gap-4 border-b border-border pb-4"
                  >
                    <div className="w-20 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img src={item.product.images[0]} alt={item.product.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="font-medium text-foreground text-sm truncate">{item.product.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {Object.entries(item.variant.options).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                      <p className="text-sm font-semibold text-foreground">{formatPrice(item.variant.price)}</p>
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center border border-border rounded-md">
                          <button className="p-1 hover:bg-accent rounded-l-md" onClick={() => updateQuantity(item.variantId, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                          <button className="p-1 hover:bg-accent rounded-r-md" onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button onClick={() => removeFromCart(item.variantId)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Summary */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotaal</span>
                <span>{formatPrice(state.cart.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>BTW ({(state.cart.taxRate * 100).toFixed(0)}%)</span>
                <span>{formatPrice(state.cart.tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-foreground">
                <span>Totaal</span>
                <span>{formatPrice(state.cart.total)}</span>
              </div>
              <Button className="w-full" size="lg" asChild onClick={() => toggleCart(false)}>
                <Link to={`${shopBasePath}/checkout`}>Afrekenen</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

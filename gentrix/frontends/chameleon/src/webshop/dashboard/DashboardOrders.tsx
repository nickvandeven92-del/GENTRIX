import { useState } from 'react';
import { useWebshop } from '@/webshop';
import type { OrderStatus } from '@/webshop/types';
import { OrderStatusBadge } from './DashboardOverview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, ChevronUp, Package } from 'lucide-react';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'Nieuw' },
  { value: 'paid', label: 'Betaald' },
  { value: 'processing', label: 'In behandeling' },
  { value: 'shipped', label: 'Verzonden' },
  { value: 'delivered', label: 'Afgeleverd' },
  { value: 'cancelled', label: 'Geannuleerd' },
];

export default function DashboardOrders() {
  const { state, updateOrderStatus, formatPrice } = useWebshop();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  let orders = state.orders;
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(o =>
      o.orderNumber.toLowerCase().includes(q) ||
      o.checkout.email.toLowerCase().includes(q) ||
      `${o.checkout.firstName} ${o.checkout.lastName}`.toLowerCase().includes(q)
    );
  }
  if (filterStatus !== 'all') {
    orders = orders.filter(o => o.status === filterStatus);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground">{state.orders.length} orders totaal</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op ordernummer, klant..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
        >
          <option value="all">Alle statussen</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {orders.map(order => (
          <div key={order.id} className="border border-border rounded-lg bg-card overflow-hidden">
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
            >
              <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-card-foreground">{order.orderNumber}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {order.checkout.firstName} {order.checkout.lastName} — {order.checkout.email}
                </p>
              </div>
              <span className="font-bold text-card-foreground">{formatPrice(order.total)}</span>
              <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString('nl-NL')}</span>
              {expandedOrder === order.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>

            {expandedOrder === order.id && (
              <div className="border-t border-border p-4 space-y-4">
                {/* Items */}
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground mb-2">Items</h3>
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-foreground">
                        {item.productName} <span className="text-muted-foreground text-xs">({item.variantLabel})</span> × {item.quantity}
                      </span>
                      <span className="font-medium text-foreground">{formatPrice(item.totalPrice)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotaal</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">BTW</span>
                    <span>{formatPrice(order.tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Totaal</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground mb-1">Verzendadres</h3>
                  <p className="text-sm text-muted-foreground">
                    {order.checkout.firstName} {order.checkout.lastName}<br />
                    {order.checkout.address}<br />
                    {order.checkout.postalCode} {order.checkout.city}
                  </p>
                </div>

                {/* Status update */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-card-foreground">Status wijzigen:</span>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(s => (
                      <Button
                        key={s.value}
                        size="sm"
                        variant={order.status === s.value ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => updateOrderStatus(order.id, s.value)}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">Geen orders gevonden</div>
        )}
      </div>
    </div>
  );
}

import { useWebshop } from '@/webshop';
import { Package, ShoppingCart, Warehouse, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';
import { isLowStock } from '@/webshop/types';

export default function DashboardOverview() {
  const { state, formatPrice } = useWebshop();
  const activeProducts = state.products.filter(p => p.active);
  const lowStockProducts = state.products.filter(p => p.active && isLowStock(p));
  const outOfStock = state.products.filter(p => p.active && p.totalStock <= 0);
  const totalRevenue = state.orders.reduce((s, o) => o.status !== 'cancelled' ? s + o.total : s, 0);
  const newOrders = state.orders.filter(o => o.status === 'new');

  const stats = [
    { label: 'Actieve producten', value: activeProducts.length, icon: Package, color: 'text-primary' },
    { label: 'Totale voorraad', value: state.products.reduce((s, p) => s + p.totalStock, 0), icon: Warehouse, color: 'text-primary' },
    { label: 'Nieuwe orders', value: newOrders.length, icon: ShoppingCart, color: 'text-primary' },
    { label: 'Omzet', value: formatPrice(totalRevenue), icon: DollarSign, color: 'text-primary' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overzicht van je webshop</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="border border-border rounded-lg p-4 bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(lowStockProducts.length > 0 || outOfStock.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Voorraadwaarschuwingen
          </h2>
          {outOfStock.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 border border-destructive/30 rounded-md bg-destructive/5">
              <span className="text-xs font-bold text-destructive px-2 py-0.5 rounded bg-destructive/10">Uitverkocht</span>
              <span className="text-sm text-foreground font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">0 op voorraad</span>
            </div>
          ))}
          {lowStockProducts.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 border border-border rounded-md bg-accent/50">
              <span className="text-xs font-bold text-foreground px-2 py-0.5 rounded bg-accent">Laag</span>
              <span className="text-sm text-foreground font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{p.totalStock} op voorraad (drempel: {p.lowStockThreshold})</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent orders */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> Recente orders
        </h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Klant</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {state.orders.slice(0, 5).map(order => (
                <tr key={order.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{order.checkout.firstName} {order.checkout.lastName}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{formatPrice(order.total)}</td>
                </tr>
              ))}
              {state.orders.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nog geen orders</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-primary/10 text-primary',
    paid: 'bg-primary/10 text-primary',
    processing: 'bg-accent text-accent-foreground',
    shipped: 'bg-accent text-accent-foreground',
    delivered: 'bg-primary/10 text-primary',
    cancelled: 'bg-destructive/10 text-destructive',
  };
  const labels: Record<string, string> = {
    new: 'Nieuw', paid: 'Betaald', processing: 'In behandeling',
    shipped: 'Verzonden', delivered: 'Afgeleverd', cancelled: 'Geannuleerd',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles[status] || ''}`}>
      {labels[status] || status}
    </span>
  );
}

import { useAnalytics } from '../analytics/AnalyticsTracker';
import { Button } from '@/components/ui/button';
import { BarChart3, Eye, ShoppingCart, CreditCard, Heart, Search, Trash2 } from 'lucide-react';

const EVENT_LABELS: Record<string, { label: string; icon: typeof Eye }> = {
  page_view: { label: 'Paginaweergaven', icon: Eye },
  product_view: { label: 'Productweergaven', icon: Eye },
  add_to_cart: { label: 'Toegevoegd aan winkelwagen', icon: ShoppingCart },
  remove_from_cart: { label: 'Verwijderd uit winkelwagen', icon: ShoppingCart },
  begin_checkout: { label: 'Checkout gestart', icon: CreditCard },
  purchase: { label: 'Aankopen', icon: CreditCard },
  search: { label: 'Zoekopdrachten', icon: Search },
  wishlist_add: { label: 'Aan verlanglijst toegevoegd', icon: Heart },
  wishlist_remove: { label: 'Uit verlanglijst verwijderd', icon: Heart },
  discount_applied: { label: 'Kortingscodes toegepast', icon: BarChart3 },
};

export default function DashboardAnalytics() {
  const { getEvents, getEventsByType, clearEvents } = useAnalytics();
  const events = getEvents();

  const eventCounts = Object.keys(EVENT_LABELS).map(type => ({
    type,
    ...EVENT_LABELS[type],
    count: getEventsByType(type as any).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">{events.length} events in deze sessie</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={clearEvents}>
          <Trash2 className="h-4 w-4" /> Reset
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {eventCounts.map(({ type, label, icon: Icon, count }) => (
          <div key={type} className="border border-border rounded-lg p-4 bg-card space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </div>
            <p className="text-2xl font-bold text-card-foreground">{count}</p>
          </div>
        ))}
      </div>

      {/* Recent events */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Recente events</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Tijd</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Event</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(-20).reverse().map(event => (
                <tr key={event.id} className="border-t border-border">
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString('nl-NL')}
                  </td>
                  <td className="p-3 text-foreground font-medium">{EVENT_LABELS[event.type]?.label || event.type}</td>
                  <td className="p-3 text-muted-foreground text-xs font-mono truncate max-w-xs">
                    {JSON.stringify(event.data)}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Nog geen events geregistreerd</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

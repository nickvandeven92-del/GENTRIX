import { useState } from 'react';
import { useWebshop } from '@/webshop';
import { getVariantLabel, getAvailableStock } from '@/webshop/types';
import type { StockMutationType } from '@/webshop/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, AlertTriangle, ArrowUpCircle, History } from 'lucide-react';

type InventoryView = 'overview' | 'mutations';

export default function DashboardInventory() {
  const { state, adjustStock, bulkAdjustStock } = useWebshop();
  const [view, setView] = useState<InventoryView>('overview');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out' | 'ok'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set()); // variantId set
  const [bulkQty, setBulkQty] = useState(0);
  const [bulkReason, setBulkReason] = useState('');

  // Adjustment modal state
  const [adjusting, setAdjusting] = useState<{ productId: string; variantId: string; productName: string; variantLabel: string } | null>(null);
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState('');
  const [adjType, setAdjType] = useState<StockMutationType>('adjustment');

  // Build flat inventory list
  const inventoryRows = state.products.flatMap(p =>
    p.variants.map(v => ({
      productId: p.id, product: p, variant: v,
      label: getVariantLabel(v),
      available: getAvailableStock(v),
      isLow: p.active && v.stock > 0 && v.stock <= p.lowStockThreshold,
      isOut: v.stock <= 0 && !v.allowBackorder,
    }))
  ).filter(row => {
    if (search) {
      const q = search.toLowerCase();
      if (!row.product.name.toLowerCase().includes(q) && !(row.variant.sku || '').toLowerCase().includes(q)) return false;
    }
    if (filterStatus === 'low') return row.isLow;
    if (filterStatus === 'out') return row.isOut;
    if (filterStatus === 'ok') return !row.isLow && !row.isOut;
    return true;
  });

  const handleAdjust = () => {
    if (!adjusting || adjQty === 0) return;
    adjustStock(adjusting.productId, adjusting.variantId, adjQty, adjReason || 'Handmatige correctie', adjType);
    setAdjusting(null);
    setAdjQty(0);
    setAdjReason('');
  };

  const handleBulkAdjust = () => {
    if (selected.size === 0 || bulkQty === 0) return;
    const adjustments = [...selected].map(variantId => {
      const row = inventoryRows.find(r => r.variant.id === variantId);
      return row ? { productId: row.productId, variantId, quantity: bulkQty } : null;
    }).filter(Boolean) as { productId: string; variantId: string; quantity: number }[];
    bulkAdjustStock(adjustments, bulkReason || 'Bulk aanpassing');
    setSelected(new Set());
    setBulkQty(0);
    setBulkReason('');
  };

  const mutationTypeLabels: Record<string, string> = {
    sale: 'Verkoop', return: 'Retour', adjustment: 'Correctie',
    restock: 'Herbevoorrading', reservation: 'Reservering', release: 'Vrijgave',
  };

  if (view === 'mutations') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Voorraadmutaties</h1>
            <p className="text-muted-foreground">{state.stockMutations.length} mutaties</p>
          </div>
          <Button variant="outline" onClick={() => setView('overview')}>
            <ArrowUpCircle className="h-4 w-4 mr-2" /> Terug naar overzicht
          </Button>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Datum</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Variant</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Aantal</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Voorraad</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reden</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Door</th>
              </tr>
            </thead>
            <tbody>
              {state.stockMutations.map(mut => (
                <tr key={mut.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(mut.createdAt).toLocaleDateString('nl-NL')}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{mut.productName}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{mut.variantLabel}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-accent text-accent-foreground">
                      {mutationTypeLabels[mut.type] || mut.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${mut.quantity > 0 ? 'text-primary' : 'text-destructive'}`}>
                    {mut.quantity > 0 ? '+' : ''}{mut.quantity}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {mut.previousStock} → {mut.newStock}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{mut.reason}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{mut.reference || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{mut.createdBy}</td>
                </tr>
              ))}
              {state.stockMutations.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nog geen mutaties</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Voorraadbeheer</h1>
          <p className="text-muted-foreground">{inventoryRows.length} varianten</p>
        </div>
        <Button variant="outline" onClick={() => setView('mutations')}>
          <History className="h-4 w-4 mr-2" /> Mutatiegeschiedenis
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op naam of SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as 'all' | 'low' | 'out' | 'ok')}
          className="px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
        >
          <option value="all">Alle</option>
          <option value="ok">Op voorraad</option>
          <option value="low">Lage voorraad</option>
          <option value="out">Uitverkocht</option>
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 border border-border rounded-md bg-accent/50">
          <span className="text-sm font-medium text-foreground">{selected.size} geselecteerd</span>
          <Input type="number" placeholder="Aantal (+/-)" className="w-28 h-9" value={bulkQty || ''} onChange={e => setBulkQty(parseInt(e.target.value) || 0)} />
          <Input placeholder="Reden" className="w-48 h-9" value={bulkReason} onChange={e => setBulkReason(e.target.value)} />
          <Button size="sm" onClick={handleBulkAdjust} disabled={bulkQty === 0}>
            Voorraad aanpassen
          </Button>
        </div>
      )}

      {/* Adjustment modal */}
      {adjusting && (
        <div className="border-2 border-primary rounded-lg p-4 bg-card space-y-3">
          <h3 className="font-semibold text-card-foreground">Voorraad aanpassen: {adjusting.productName} — {adjusting.variantLabel}</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select value={adjType} onChange={e => setAdjType(e.target.value as StockMutationType)} className="block px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground">
                <option value="adjustment">Correctie</option>
                <option value="restock">Herbevoorrading</option>
                <option value="return">Retour</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Aantal (+/-)</label>
              <Input type="number" className="w-24" value={adjQty || ''} onChange={e => setAdjQty(parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex-1 min-w-32">
              <label className="text-xs text-muted-foreground">Reden</label>
              <Input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="Reden voor aanpassing" />
            </div>
            <Button size="sm" onClick={handleAdjust} disabled={adjQty === 0}>Toepassen</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdjusting(null)}>Annuleren</Button>
          </div>
        </div>
      )}

      {/* Inventory table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 w-10">
                <Checkbox
                  checked={selected.size === inventoryRows.length && inventoryRows.length > 0}
                  onCheckedChange={() => {
                    if (selected.size === inventoryRows.length) setSelected(new Set());
                    else setSelected(new Set(inventoryRows.map(r => r.variant.id)));
                  }}
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Variant</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Voorraad</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gereserveerd</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Beschikbaar</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actie</th>
            </tr>
          </thead>
          <tbody>
            {inventoryRows.map(row => (
              <tr key={row.variant.id} className="border-t border-border hover:bg-accent/30">
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selected.has(row.variant.id)}
                    onCheckedChange={() => {
                      const next = new Set(selected);
                      if (next.has(row.variant.id)) next.delete(row.variant.id);
                      else next.add(row.variant.id);
                      setSelected(next);
                    }}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{row.product.name}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{row.label}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.variant.sku || '—'}</td>
                <td className="px-4 py-3">
                  {row.isOut ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                      <AlertTriangle className="h-3 w-3" /> Uitverkocht
                    </span>
                  ) : row.isLow ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-accent text-accent-foreground">
                      <AlertTriangle className="h-3 w-3" /> Laag
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">Op voorraad</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">{row.variant.stock}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{row.variant.reservedStock}</td>
                <td className="px-4 py-3 text-right font-bold text-foreground">{row.available}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setAdjusting({
                      productId: row.productId, variantId: row.variant.id,
                      productName: row.product.name, variantLabel: row.label,
                    })}
                  >
                    Aanpassen
                  </Button>
                </td>
              </tr>
            ))}
            {inventoryRows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Geen resultaten</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

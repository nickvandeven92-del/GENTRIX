import { useState } from 'react';
import { useWebshop } from '@/webshop';
import { isLowStock, isOutOfStock } from '@/webshop/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus, ToggleLeft, ToggleRight, Trash2, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

type FilterStatus = 'all' | 'active' | 'inactive' | 'low_stock' | 'out_of_stock';

export default function DashboardProducts() {
  const { state, toggleProductActive, deleteProduct, bulkSetStatus } = useWebshop();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  let products = state.products;
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(q) || p.variants.some(v => v.sku?.toLowerCase().includes(q)));
  }
  if (filterStatus === 'active') products = products.filter(p => p.active);
  if (filterStatus === 'inactive') products = products.filter(p => !p.active);
  if (filterStatus === 'low_stock') products = products.filter(p => isLowStock(p));
  if (filterStatus === 'out_of_stock') products = products.filter(p => isOutOfStock(p));
  if (filterCategory !== 'all') products = products.filter(p => p.categoryId === filterCategory);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map(p => p.id)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Producten</h1>
          <p className="text-muted-foreground">{state.products.length} producten</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/products/new"><Plus className="h-4 w-4 mr-2" /> Nieuw product</Link>
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
          onChange={e => setFilterStatus(e.target.value as FilterStatus)}
          className="px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
        >
          <option value="all">Alle statussen</option>
          <option value="active">Actief</option>
          <option value="inactive">Inactief</option>
          <option value="low_stock">Lage voorraad</option>
          <option value="out_of_stock">Uitverkocht</option>
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
        >
          <option value="all">Alle categorieën</option>
          {state.categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-accent/50">
          <span className="text-sm font-medium text-foreground">{selected.size} geselecteerd</span>
          <Button size="sm" variant="outline" onClick={() => { bulkSetStatus([...selected], true); setSelected(new Set()); }}>
            <Eye className="h-3 w-3 mr-1" /> Activeren
          </Button>
          <Button size="sm" variant="outline" onClick={() => { bulkSetStatus([...selected], false); setSelected(new Set()); }}>
            <EyeOff className="h-3 w-3 mr-1" /> Deactiveren
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 w-10">
                <Checkbox checked={selected.size === products.length && products.length > 0} onCheckedChange={toggleAll} />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Categorie</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Voorraad</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Prijs</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acties</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => {
              const cat = state.categories.find(c => c.id === product.categoryId);
              const low = isLowStock(product);
              const out = isOutOfStock(product);
              return (
                <tr key={product.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox checked={selected.has(product.id)} onCheckedChange={() => toggleSelect(product.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/dashboard/products/${product.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {product.variants[0]?.sku || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{cat?.name || '—'}</td>
                  <td className="px-4 py-3">
                    {out ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">Uitverkocht</span>
                    ) : low ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-accent text-accent-foreground">Laag</span>
                    ) : product.active ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">Actief</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">Inactief</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {product.totalStock}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    €{product.basePrice.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleProductActive(product.id)} title={product.active ? 'Deactiveren' : 'Activeren'}>
                        {product.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void deleteProduct(product.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Geen producten gevonden</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

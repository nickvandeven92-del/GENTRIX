import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWebshop } from '@/webshop';
import type { Product, ProductVariant } from '@/webshop/types';
import { getVariantLabel, getAvailableStock } from '@/webshop/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';

function createDraftProduct(categoryId: string): Product {
  const ts = Date.now();
  const iso = new Date(ts).toISOString();
  return {
    id: `prod-${ts}`,
    slug: '',
    name: '',
    description: '',
    shortDescription: '',
    images: [''],
    categoryId: categoryId || '',
    tags: [],
    variantOptions: [{ name: 'Maat', values: ['M'] }],
    variants: [
      {
        id: `v-${ts}`,
        options: { Maat: 'M' },
        price: 0,
        stock: 0,
        reservedStock: 0,
        sku: '',
        trackInventory: true,
        allowBackorder: false,
      },
    ],
    basePrice: 0,
    totalStock: 0,
    status: 'draft',
    active: false,
    trackInventory: true,
    allowBackorder: false,
    lowStockThreshold: 5,
    createdAt: iso,
    updatedAt: iso,
  };
}

function newVariantRowId(variantIndex: number): string {
  return `v-${Date.now()}-${variantIndex}`;
}

export default function DashboardProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, getProductById, updateProduct, addProduct } = useWebshop();
  const isNew = id === 'new';

  const existing = isNew ? null : getProductById(id!);

  const [form, setForm] = useState<Product>(() =>
    existing ?? createDraftProduct(state.categories[0]?.id || ''),
  );

  const updateField = <K extends keyof Product>(key: K, value: Product[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const updateVariant = (variantId: string, updates: Partial<ProductVariant>) =>
    setForm(prev => ({
      ...prev,
      variants: prev.variants.map(v => v.id === variantId ? { ...v, ...updates } : v),
    }));

  const addVariant = () =>
    setForm(prev => ({
      ...prev,
      variants: [...prev.variants, {
        id: newVariantRowId(prev.variants.length),
        options: Object.fromEntries(prev.variantOptions.map(o => [o.name, o.values[0] || ''])),
        price: prev.basePrice, stock: 0, reservedStock: 0, sku: '',
        trackInventory: true, allowBackorder: false,
      }],
    }));

  const removeVariant = (variantId: string) =>
    setForm(prev => ({ ...prev, variants: prev.variants.filter(v => v.id !== variantId) }));

  const handleSave = async () => {
    const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const product = {
      ...form,
      slug,
      basePrice: form.variants[0]?.price || form.basePrice,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (isNew) await addProduct(product);
      else await updateProduct(product);
      navigate('/dashboard/products');
    } catch {
      /* foutmelding via UI indien nodig */
    }
  };

  if (!isNew && !existing) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Product niet gevonden</p>
        <Link to="/dashboard/products" className="text-primary hover:underline">Terug</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/products" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{isNew ? 'Nieuw product' : form.name}</h1>
        </div>
        <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Opslaan</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <h2 className="font-semibold text-card-foreground">Productinformatie</h2>
            <div>
              <Label>Naam</Label>
              <Input value={form.name} onChange={e => updateField('name', e.target.value)} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug} onChange={e => updateField('slug', e.target.value)} placeholder="automatisch gegenereerd" />
            </div>
            <div>
              <Label>Korte beschrijving</Label>
              <Input value={form.shortDescription || ''} onChange={e => updateField('shortDescription', e.target.value)} />
            </div>
            <div>
              <Label>Beschrijving</Label>
              <Textarea value={form.description} onChange={e => updateField('description', e.target.value)} rows={4} />
            </div>
            <div>
              <Label>Afbeelding URL</Label>
              <Input value={form.images[0] || ''} onChange={e => updateField('images', [e.target.value])} />
            </div>
          </div>

          {/* Variants */}
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-card-foreground">Varianten</h2>
              <Button size="sm" variant="outline" onClick={addVariant}>
                <Plus className="h-3 w-3 mr-1" /> Variant
              </Button>
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Opties</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">SKU</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Prijs</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Voorraad</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Gereserveerd</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Beschikbaar</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.variants.map(variant => (
                    <tr key={variant.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 text-xs"
                          value={getVariantLabel(variant)}
                          readOnly
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input className="h-8 text-xs font-mono" value={variant.sku || ''} onChange={e => updateVariant(variant.id, { sku: e.target.value })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" className="h-8 text-xs w-20 text-right" value={variant.price} onChange={e => updateVariant(variant.id, { price: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" className="h-8 text-xs w-16 text-right" value={variant.stock} onChange={e => updateVariant(variant.id, { stock: parseInt(e.target.value) || 0 })} />
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">{variant.reservedStock}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-foreground">{getAvailableStock(variant)}</td>
                      <td className="px-3 py-2">
                        {form.variants.length > 1 && (
                          <Button size="sm" variant="ghost" onClick={() => removeVariant(variant.id)} className="h-7 w-7 p-0 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <h2 className="font-semibold text-card-foreground">Status</h2>
            <div className="flex items-center justify-between">
              <Label>Actief</Label>
              <Switch checked={form.active} onCheckedChange={v => updateField('active', v)} />
            </div>
            <div>
              <Label>Categorie</Label>
              <select
                value={form.categoryId}
                onChange={e => updateField('categoryId', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground mt-1"
              >
                {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <h2 className="font-semibold text-card-foreground">Voorraadinstellingen</h2>
            <div className="flex items-center justify-between">
              <Label>Voorraad bijhouden</Label>
              <Switch checked={form.trackInventory} onCheckedChange={v => updateField('trackInventory', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Backorders toestaan</Label>
              <Switch checked={form.allowBackorder} onCheckedChange={v => updateField('allowBackorder', v)} />
            </div>
            <div>
              <Label>Low stock drempel</Label>
              <Input type="number" value={form.lowStockThreshold} onChange={e => updateField('lowStockThreshold', parseInt(e.target.value) || 0)} className="mt-1" />
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <h2 className="font-semibold text-card-foreground">Prijs</h2>
            <div>
              <Label>Basisprijs (€)</Label>
              <Input type="number" step="0.01" value={form.basePrice} onChange={e => updateField('basePrice', parseFloat(e.target.value) || 0)} className="mt-1" />
            </div>
            <div>
              <Label>Vergelijkingsprijs (€)</Label>
              <Input type="number" step="0.01" value={form.compareAtPrice || ''} onChange={e => updateField('compareAtPrice', parseFloat(e.target.value) || undefined)} className="mt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

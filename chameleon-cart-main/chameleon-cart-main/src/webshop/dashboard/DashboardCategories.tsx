import { useState } from 'react';
import { useWebshop } from '@/webshop';
import type { Category } from '@/webshop/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Save, X } from 'lucide-react';

export default function DashboardCategories() {
  const { state, addCategory, updateCategory, deleteCategory } = useWebshop();
  const [editing, setEditing] = useState<Category | null>(null);

  const startNew = () => setEditing({
    id: `cat-${Date.now()}`, slug: '', name: '', description: '', active: true, sortOrder: state.categories.length + 1,
  });

  const handleSave = () => {
    if (!editing) return;
    const cat = { ...editing, slug: editing.slug || editing.name.toLowerCase().replace(/\s+/g, '-') };
    if (state.categories.find(c => c.id === cat.id)) updateCategory(cat);
    else addCategory(cat);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorieën</h1>
          <p className="text-muted-foreground">{state.categories.length} categorieën</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" /> Nieuwe categorie</Button>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="border border-border rounded-lg p-6 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-card-foreground">
              {state.categories.find(c => c.id === editing.id) ? 'Categorie bewerken' : 'Nieuwe categorie'}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Naam</Label>
              <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={editing.slug} onChange={e => setEditing({ ...editing, slug: e.target.value })} placeholder="auto" />
            </div>
          </div>
          <div>
            <Label>Beschrijving</Label>
            <Textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Actief</Label>
              <Switch checked={editing.active} onCheckedChange={v => setEditing({ ...editing, active: v })} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Sorteervolgorde</Label>
              <Input type="number" className="w-20" value={editing.sortOrder} onChange={e => setEditing({ ...editing, sortOrder: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Opslaan</Button>
        </div>
      )}

      {/* List */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Naam</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Producten</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acties</th>
            </tr>
          </thead>
          <tbody>
            {state.categories.map(cat => {
              const productCount = state.products.filter(p => p.categoryId === cat.id).length;
              return (
                <tr key={cat.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-muted-foreground">{productCount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${cat.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {cat.active ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(cat)}>Bewerken</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteCategory(cat.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

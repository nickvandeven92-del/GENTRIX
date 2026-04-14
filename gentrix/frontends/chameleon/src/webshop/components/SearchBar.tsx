import { useState, useMemo } from 'react';
import { useWebshop } from '../context/WebshopContext';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ProductCard } from './ProductCard';

export function SearchBar() {
  const { state } = useWebshop();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return state.products.filter(p =>
      p.active && (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags?.some(t => t.toLowerCase().includes(q))
      )
    ).slice(0, 5);
  }, [query, state.products]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek producten..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isFocused && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 p-4 space-y-3 max-h-96 overflow-y-auto">
          {results.map(product => (
            <div key={product.id} className="flex items-center gap-3" onClick={() => { setQuery(''); setIsFocused(false); }}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
      {isFocused && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 p-4">
          <p className="text-sm text-muted-foreground text-center">Geen resultaten voor {`\u201c${query}\u201d`}</p>
        </div>
      )}
    </div>
  );
}

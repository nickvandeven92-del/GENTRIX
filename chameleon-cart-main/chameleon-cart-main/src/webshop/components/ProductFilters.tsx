import { useState } from 'react';
import { useWebshop } from '../context/WebshopContext';

interface ProductFiltersProps {
  onCategoryChange?: (categoryId: string | null) => void;
  selectedCategory?: string | null;
}

export function ProductFilters({ onCategoryChange, selectedCategory }: ProductFiltersProps) {
  const { state } = useWebshop();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onCategoryChange?.(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          !selectedCategory
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-accent'
        }`}
      >
        Alles
      </button>
      {state.categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange?.(cat.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === cat.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}

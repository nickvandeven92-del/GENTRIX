import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapCategoryRow } from '@/lib/webshop-mappers';
import type { Category } from '@/webshop/types';

export function useCategories(clientId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['categories', clientId],
    enabled: enabled && isSupabaseConfigured && Boolean(clientId),
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('client_id', clientId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(row => mapCategoryRow(row));
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapProductRow } from '@/lib/webshop-mappers';
import type { Product } from '@/webshop/types';
import type { Database } from '@/types/database';

type ProductRow = Database['public']['Tables']['products']['Row'] & {
  product_variants: Database['public']['Tables']['product_variants']['Row'][];
  product_variant_options: Database['public']['Tables']['product_variant_options']['Row'][];
};

export function useProducts(clientId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['products', clientId],
    enabled: enabled && isSupabaseConfigured && Boolean(clientId),
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from('products')
        .select(
          `*,
          product_variants (*),
          product_variant_options (*)
        `
        )
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ProductRow[]).map(mapProductRow);
    },
  });
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapMutationRow } from '@/lib/webshop-mappers';
import type { StockMutation } from '@/webshop/types';

export function useStockMutations(clientId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['stock_mutations', clientId],
    enabled: enabled && isSupabaseConfigured && Boolean(clientId),
    queryFn: async (): Promise<StockMutation[]> => {
      const { data, error } = await supabase
        .from('stock_mutations')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapMutationRow);
    },
  });
}

export function useInvalidateStockMutations() {
  const qc = useQueryClient();
  return (clientId: string) => qc.invalidateQueries({ queryKey: ['stock_mutations', clientId] });
}

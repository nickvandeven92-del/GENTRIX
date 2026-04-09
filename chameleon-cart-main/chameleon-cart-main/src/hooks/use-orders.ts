import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapOrderRow } from '@/lib/webshop-mappers';
import type { Order } from '@/webshop/types';
import type { Database } from '@/types/database';

type OrderRow = Database['public']['Tables']['orders']['Row'] & {
  order_items: Database['public']['Tables']['order_items']['Row'][];
};

export function useOrders(clientId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['orders', clientId],
    enabled: enabled && isSupabaseConfigured && Boolean(clientId),
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as OrderRow[]).map(mapOrderRow);
    },
  });
}

export function useInvalidateOrders() {
  const qc = useQueryClient();
  return (clientId: string) => qc.invalidateQueries({ queryKey: ['orders', clientId] });
}

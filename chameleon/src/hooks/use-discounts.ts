import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapDiscountRow } from '@/lib/webshop-mappers';
import type { DiscountCode } from '@/webshop/types';

export function useDiscountCodes(clientId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['discount_codes', clientId],
    enabled: enabled && isSupabaseConfigured && Boolean(clientId),
    queryFn: async (): Promise<DiscountCode[]> => {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapDiscountRow);
    },
  });
}

export function useInvalidateDiscounts() {
  const qc = useQueryClient();
  return (clientId: string) => qc.invalidateQueries({ queryKey: ['discount_codes', clientId] });
}

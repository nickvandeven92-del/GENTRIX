import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapReviewRow } from '@/lib/webshop-mappers';
import type { Review } from '@/webshop/types';

export function useReviews(clientId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['reviews', clientId],
    enabled: enabled && isSupabaseConfigured && Boolean(clientId),
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapReviewRow);
    },
  });
}

export function useInvalidateReviews() {
  const qc = useQueryClient();
  return (clientId: string) => qc.invalidateQueries({ queryKey: ['reviews', clientId] });
}

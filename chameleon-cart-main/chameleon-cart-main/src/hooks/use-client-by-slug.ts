import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type ClientRow = Database['public']['Tables']['clients']['Row'];

export function useClientBySlug(slug: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['client', 'slug', slug],
    enabled: enabled && isSupabaseConfigured && Boolean(slug),
    queryFn: async (): Promise<ClientRow | null> => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('slug', slug!)
        .eq('webshop_enabled', true)
        .maybeSingle();
      if (error) throw error;
      return data as ClientRow | null;
    },
  });
}

/** Owner / admin: mag ook niet-actieve shops laden */
export function useClientBySlugAdmin(slug: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['client', 'slug-admin', slug],
    enabled: enabled && isSupabaseConfigured && Boolean(slug),
    queryFn: async (): Promise<ClientRow | null> => {
      const { data, error } = await supabase.from('clients').select('*').eq('slug', slug!).maybeSingle();
      if (error) throw error;
      return data as ClientRow | null;
    },
  });
}

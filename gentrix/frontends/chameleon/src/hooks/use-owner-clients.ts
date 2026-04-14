import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type ClientRow = Database['public']['Tables']['clients']['Row'];

const QK = ['owner-clients'] as const;

export function useOwnerClientsList(enabled: boolean) {
  return useQuery({
    queryKey: QK,
    enabled: enabled && isSupabaseConfigured,
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });
}

export function useCreatePlaceholderClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const slug = `klant-${Date.now().toString(36)}`;
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: 'Nieuwe klant (placeholder)',
          slug,
          webshop_enabled: false,
          simple_mode: true,
          shop_name: 'Nieuwe webshop',
          shop_description: 'Activeren via het owner-dashboard.',
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as ClientRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateClientFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      webshop_enabled?: boolean;
      simple_mode?: boolean;
      name?: string;
      shop_name?: string;
    }) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from('clients').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useAssignClientAdminRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { userId: string; clientId: string }) => {
      const { error } = await supabase.from('user_roles').insert({
        user_id: payload.userId,
        role: 'client_admin',
        client_id: payload.clientId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user_roles'] }),
  });
}

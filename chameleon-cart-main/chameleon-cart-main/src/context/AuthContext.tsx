import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AppRole } from '@/types/database';

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  client_id: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: UserRoleRow[];
  isOwner: boolean;
  /** client_admin tenant */
  clientAdminClientId: string | undefined;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchRoles(userId: string): Promise<UserRoleRow[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('id, user_id, role, client_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as UserRoleRow[];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshRoles = useCallback(async () => {
    if (!isSupabaseConfigured || !session?.user?.id) {
      setRoles([]);
      return;
    }
    try {
      setRoles(await fetchRoles(session.user.id));
    } catch {
      setRoles([]);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user || !isSupabaseConfigured) {
      setRoles([]);
      return;
    }
    let cancelled = false;
    fetchRoles(session.user.id).then(r => {
      if (!cancelled) setRoles(r);
    }).catch(() => {
      if (!cancelled) setRoles([]);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: new Error('Supabase niet geconfigureerd') };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: new Error('Supabase niet geconfigureerd') };
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setRoles([]);
  }, []);

  const isOwner = roles.some(r => r.role === 'owner');
  const clientAdminClientId = roles.find(r => r.role === 'client_admin')?.client_id ?? undefined;

  const value = useMemo(
    (): AuthContextValue => ({
      user: session?.user ?? null,
      session,
      loading,
      roles,
      isOwner,
      clientAdminClientId,
      signIn,
      signUp,
      signOut,
      refreshRoles,
    }),
    [session, loading, roles, isOwner, clientAdminClientId, signIn, signUp, signOut, refreshRoles]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth moet binnen AuthProvider');
  return ctx;
}

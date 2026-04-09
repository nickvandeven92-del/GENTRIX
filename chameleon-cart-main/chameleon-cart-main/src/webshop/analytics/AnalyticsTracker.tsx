import { createContext, useContext, useCallback, useRef } from 'react';
import type { AnalyticsEvent, AnalyticsEventType } from '../types';
import { useWebshop } from '../context/WebshopContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface AnalyticsContextValue {
  track: (type: AnalyticsEventType, data?: Record<string, unknown>) => void;
  getEvents: () => AnalyticsEvent[];
  getEventsByType: (type: AnalyticsEventType) => AnalyticsEvent[];
  clearEvents: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

function generateSessionId() {
  const stored = sessionStorage.getItem('ws_session_id');
  if (stored) return stored;
  const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem('ws_session_id', id);
  return id;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const eventsRef = useRef<AnalyticsEvent[]>([]);
  const sessionId = useRef(generateSessionId());
  const { clientId, guestSessionId } = useWebshop();

  const track = useCallback(
    (type: AnalyticsEventType, data: Record<string, unknown> = {}) => {
      const event: AnalyticsEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        data,
        timestamp: new Date().toISOString(),
        sessionId: sessionId.current,
      };
      eventsRef.current = [...eventsRef.current, event];

      if (import.meta.env.DEV) {
        console.log(`[Analytics] ${type}`, data);
      }

      if (isSupabaseConfigured && clientId) {
        void supabase.from('analytics_events').insert({
          client_id: clientId,
          type,
          data,
          session_id: guestSessionId,
        });
      }
    },
    [clientId, guestSessionId]
  );

  const getEvents = useCallback(() => eventsRef.current, []);
  const getEventsByType = useCallback(
    (type: AnalyticsEventType) => eventsRef.current.filter(e => e.type === type),
    []
  );
  const clearEvents = useCallback(() => {
    eventsRef.current = [];
  }, []);

  return (
    <AnalyticsContext.Provider value={{ track, getEvents, getEventsByType, clearEvents }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics must be used within AnalyticsProvider');
  return ctx;
}

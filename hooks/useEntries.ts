'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Entry } from '@/lib/types';

// Returns today's entries for the logged-in user, live-updated via Supabase realtime
export function useEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Initial fetch
    supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .gte('occurred_at', todayStart.toISOString())
      .order('occurred_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setEntries(data as Entry[]);
        setLoading(false);
      });

    // Real-time subscription
    const channel = supabase
      .channel('entries-today')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEntries((prev) => [payload.new as Entry, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setEntries((prev) => prev.filter((e) => e.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const removeEntry = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  return { entries, loading, removeEntry };
}

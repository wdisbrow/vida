'use client';
import { useState, useEffect } from 'react';

export interface Goals {
  daily_calories: number;
  daily_water_oz: number;
  sleep_hours: number;
  exercise_days_week: number;
}

export const DEFAULT_GOALS: Goals = {
  daily_calories: 1800,
  daily_water_oz: 64,
  sleep_hours: 7.5,
  exercise_days_week: 4,
};

export function useGoals(userId: string | undefined) {
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/goals?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setGoals({ ...DEFAULT_GOALS, ...data });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const saveGoals = async (updated: Goals): Promise<boolean> => {
    if (!userId) return false;
    setSaving(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updated }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setGoals(updated);
      return true;
    } catch (err) {
      console.error('Goals save error:', err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { goals, loading, saving, saveGoals };
}

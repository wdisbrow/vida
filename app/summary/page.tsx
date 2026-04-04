'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FoodData, HealthData } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RawEntry {
  category: string;
  occurred_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed_data: any;
}

interface DaySummary {
  date: Date;
  dateKey: string;          // "2026-04-01"
  label: string;            // "Mon"
  calories: number;
  waterOz: number;
  sleepHrs: number;
  exerciseCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getLast7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

const TODAY_KEY = typeof window !== 'undefined' ? dateKey(new Date()) : '';

function shortDay(d: Date): string {
  const label = d.toLocaleDateString('en-US', { weekday: 'short' });
  const isToday = dateKey(d) === TODAY_KEY;
  return isToday ? 'Today' : label.slice(0, 3);
}

// ─── Bar chart section ────────────────────────────────────────────────────────
function BarChart({
  title,
  days,
  values,
  maxValue,
  color,
  unit,
  formatVal,
}: {
  title: string;
  days: DaySummary[];
  values: number[];
  maxValue: number;
  color: string;
  todayColor: string;
  unit: string;
  formatVal?: (v: number) => string;
}) {
  const cap = Math.max(maxValue, 1);
  const fmt = formatVal ?? ((v: number) => String(Math.round(v)));

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-gray-700 font-semibold mb-3">{title}</p>

      {/* Bars */}
      <div className="flex items-end gap-1.5 h-28">
        {values.map((v, i) => {
          const heightPct = v > 0 ? Math.max((v / cap) * 100, 5) : 0;
          const isToday   = i === values.length - 1;

          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              {v > 0 && (
                <span className="text-xs text-gray-400 leading-none">
                  {fmt(v)}
                </span>
              )}
              <div
                className={`w-full rounded-t-md transition-all ${
                  isToday ? color.replace('300', '500') : color
                } ${v === 0 ? 'opacity-10' : ''}`}
                style={{ height: `${heightPct}%`, minHeight: v > 0 ? '6px' : '2px' }}
              />
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div className="flex mt-1.5">
        {days.map((d, i) => (
          <span
            key={i}
            className={`flex-1 text-center text-xs truncate ${
              i === days.length - 1
                ? 'text-blue-600 font-semibold'
                : 'text-gray-400'
            }`}
          >
            {d.label}
          </span>
        ))}
      </div>

      {/* Unit hint */}
      <p className="text-right text-xs text-gray-300 mt-0.5">{unit}</p>
    </div>
  );
}

// ─── Exercise dots ────────────────────────────────────────────────────────────
function ExerciseRow({ days }: { days: DaySummary[] }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-gray-700 font-semibold mb-3">💪 Exercise</p>
      <div className="flex justify-between gap-1">
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          const active  = d.exerciseCount > 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`w-full aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  active
                    ? 'bg-green-400 text-white'
                    : isToday
                    ? 'bg-blue-50 border-2 border-blue-200 text-blue-300'
                    : 'bg-gray-100 text-gray-300'
                }`}
              >
                {active ? '✓' : '·'}
              </div>
              <span
                className={`text-xs truncate ${
                  isToday ? 'text-blue-600 font-semibold' : 'text-gray-400'
                }`}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SummaryPage() {
  const router  = useRouter();
  const [userId,  setUserId]  = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<RawEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
      else setUserId(data.user.id);
    });
  }, [router]);

  // Fetch last 7 days of entries
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/summary?userId=${userId}&days=7`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEntries(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  // Compute per-day summaries
  const days = useMemo<DaySummary[]>(() => {
    return getLast7Days().map((date) => {
      const key        = dateKey(date);
      const dayEntries = entries.filter((e) => e.occurred_at.startsWith(key));

      const calories = dayEntries
        .filter((e) => e.category === 'food')
        .reduce((s, e) => s + ((e.parsed_data as FoodData).calories ?? 0), 0);

      const waterOz = dayEntries
        .filter(
          (e) =>
            e.category === 'health' &&
            (e.parsed_data as HealthData).metricType === 'water'
        )
        .reduce((s, e) => s + ((e.parsed_data as HealthData).value ?? 0), 0);

      const sleepEntry = dayEntries
        .filter(
          (e) =>
            e.category === 'health' &&
            (e.parsed_data as HealthData).metricType === 'sleep'
        )
        .at(-1);
      const sleepHrs = sleepEntry
        ? ((sleepEntry.parsed_data as HealthData).value ?? 0)
        : 0;

      const exerciseCount = dayEntries.filter((e) => e.category === 'exercise').length;

      return { date, dateKey: key, label: shortDay(date), calories, waterOz, sleepHrs, exerciseCount };
    });
  }, [entries]);

  const maxCalories = Math.max(...days.map((d) => d.calories), 1);
  const maxWater    = Math.max(...days.map((d) => d.waterOz),  1);
  const maxSleep    = Math.max(...days.map((d) => d.sleepHrs), 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const hasAnyData = days.some(
    (d) => d.calories > 0 || d.waterOz > 0 || d.sleepHrs > 0 || d.exerciseCount > 0
  );

  return (
    <div className="px-4 pt-6 space-y-4 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-blue-900">Summary</h1>
        <p className="text-gray-500 text-lg">Last 7 days</p>
      </div>

      {!hasAnyData ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-700 font-semibold text-lg">No data yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Start logging food, exercise, and health entries — your trends will appear here.
          </p>
        </div>
      ) : (
        <>
          <BarChart
            title="🍽️ Calories"
            days={days}
            values={days.map((d) => d.calories)}
            maxValue={maxCalories}
            color="bg-blue-300"
            todayColor="bg-blue-500"
            unit="cal"
          />

          <BarChart
            title="💧 Water"
            days={days}
            values={days.map((d) => d.waterOz)}
            maxValue={maxWater}
            color="bg-cyan-300"
            todayColor="bg-cyan-500"
            unit="oz"
          />

          <BarChart
            title="😴 Sleep"
            days={days}
            values={days.map((d) => d.sleepHrs)}
            maxValue={maxSleep}
            color="bg-purple-300"
            todayColor="bg-purple-500"
            unit="hrs"
            formatVal={(v) => v.toFixed(1)}
          />

          <ExerciseRow days={days} />
        </>
      )}
    </div>
  );
}

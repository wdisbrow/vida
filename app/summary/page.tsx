'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FoodData, ExerciseData, HealthData } from '@/lib/types';
import { useGoals } from '@/hooks/useGoals';

interface RawEntry {
  category: string;
  occurred_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed_data: any;
}

interface DaySummary {
  date: Date;
  dateKey: string;
  label: string;
  calories: number;
  waterOz: number;
  sleepHrs: number;
  exerciseCount: number;
  moodScore: number | null;
}

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

function moodEmoji(score: number): string {
  if (score >= 8) return '😄';
  if (score >= 6) return '🙂';
  if (score >= 4) return '😐';
  if (score >= 2) return '😕';
  return '😞';
}

function moodBarColor(score: number): string {
  if (score >= 8) return 'bg-green-400';
  if (score >= 6) return 'bg-lime-400';
  if (score >= 4) return 'bg-yellow-400';
  if (score >= 2) return 'bg-orange-400';
  return 'bg-red-400';
}

function moodBarColorToday(score: number): string {
  if (score >= 8) return 'bg-green-600';
  if (score >= 6) return 'bg-lime-600';
  if (score >= 4) return 'bg-yellow-500';
  if (score >= 2) return 'bg-orange-500';
  return 'bg-red-600';
}

function intensityColor(intensity?: string): string {
  if (intensity === 'vigorous') return 'bg-red-100 text-red-700';
  if (intensity === 'moderate') return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

function mealTypeColor(mealType?: string): string {
  if (mealType === 'breakfast') return 'bg-orange-100 text-orange-700';
  if (mealType === 'lunch')     return 'bg-blue-100 text-blue-700';
  if (mealType === 'dinner')    return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-500';
}

// ─── Calorie Detail Panel ─────────────────────────────────────────────────────

function CalorieDetail({
  dateKey,
  dayLabel,
  entries,
  onClose,
}: {
  dateKey: string;
  dayLabel: string;
  entries: RawEntry[];
  onClose: () => void;
}) {
  const foodEntries = entries
    .filter((e) => e.category === 'food' && e.occurred_at.startsWith(dateKey))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  const total = foodEntries.reduce(
    (s, e) => s + ((e.parsed_data as FoodData).calories ?? 0),
    0
  );

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 -mt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-blue-800">🍽️ {dayLabel} — food log</p>
        <button onClick={onClose} className="text-blue-300 hover:text-blue-500 text-lg leading-none">×</button>
      </div>

      {foodEntries.length === 0 ? (
        <p className="text-sm text-blue-400 text-center py-2">No food entries logged</p>
      ) : (
        <div className="space-y-2">
          {foodEntries.map((e, i) => {
            const d = e.parsed_data as FoodData;
            const time = new Date(e.occurred_at).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit',
            });
            return (
              <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-shrink-0">
                    {d.mealType === 'breakfast' ? '🌅' : d.mealType === 'lunch' ? '☀️' : d.mealType === 'dinner' ? '🌙' : '🍎'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.foodName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {d.quantity && <span className="text-xs text-gray-400">{d.quantity}</span>}
                      {d.mealType && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${mealTypeColor(d.mealType)}`}>
                          {d.mealType}
                        </span>
                      )}
                      <span className="text-xs text-gray-300">{time}</span>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-blue-700 ml-2 flex-shrink-0">
                  {d.calories != null ? `${Math.round(d.calories)} cal` : '—'}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between items-center pt-1 border-t border-blue-200 mt-1">
            <span className="text-xs text-blue-500 font-medium">
              {foodEntries.length} {foodEntries.length === 1 ? 'item' : 'items'}
            </span>
            <span className="text-sm font-bold text-blue-800">{Math.round(total)} cal total</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exercise Detail Panel ────────────────────────────────────────────────────

function ExerciseDetail({
  dateKey,
  dayLabel,
  entries,
  onClose,
}: {
  dateKey: string;
  dayLabel: string;
  entries: RawEntry[];
  onClose: () => void;
}) {
  const exerciseEntries = entries
    .filter((e) => e.category === 'exercise' && e.occurred_at.startsWith(dateKey))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  const totalBurned = exerciseEntries.reduce(
    (s, e) => s + ((e.parsed_data as ExerciseData).caloriesBurned ?? 0),
    0
  );

  return (
    <div className="bg-green-50 border border-green-100 rounded-2xl p-4 -mt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-green-800">💪 {dayLabel} — exercise log</p>
        <button onClick={onClose} className="text-green-300 hover:text-green-500 text-lg leading-none">×</button>
      </div>

      {exerciseEntries.length === 0 ? (
        <p className="text-sm text-green-400 text-center py-2">No exercise logged</p>
      ) : (
        <div className="space-y-2">
          {exerciseEntries.map((e, i) => {
            const d = e.parsed_data as ExerciseData;
            const time = new Date(e.occurred_at).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit',
            });
            const durationStr = d.duration ? `${d.duration} ${d.durationUnit ?? 'min'}` : null;
            return (
              <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex-shrink-0 text-lg">🏃</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 capitalize truncate">{d.activityType}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {durationStr && <span className="text-xs text-gray-400">{durationStr}</span>}
                      {d.intensity && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${intensityColor(d.intensity)}`}>
                          {d.intensity}
                        </span>
                      )}
                      <span className="text-xs text-gray-300">{time}</span>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-green-700 ml-2 flex-shrink-0">
                  {d.caloriesBurned != null ? `−${Math.round(d.caloriesBurned)} cal` : '—'}
                </span>
              </div>
            );
          })}
          {totalBurned > 0 && (
            <div className="flex justify-between items-center pt-1 border-t border-green-200 mt-1">
              <span className="text-xs text-green-500 font-medium">
                {exerciseEntries.length} {exerciseEntries.length === 1 ? 'workout' : 'workouts'}
              </span>
              <span className="text-sm font-bold text-green-800">−{Math.round(totalBurned)} cal burned</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function BarChart({
  title, days, values, maxValue, color, unit, goalValue, formatVal,
  selectedDayKey, onDayClick,
}: {
  title: string;
  days: DaySummary[];
  values: number[];
  maxValue: number;
  color: string;
  todayColor: string;
  unit: string;
  goalValue?: number;
  formatVal?: (v: number) => string;
  selectedDayKey?: string | null;
  onDayClick?: (dk: string) => void;
}) {
  const cap     = Math.max(maxValue, goalValue ?? 0, 1);
  const fmt     = formatVal ?? ((v: number) => String(Math.round(v)));
  const goalPct = goalValue && goalValue > 0 ? (goalValue / cap) * 100 : null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-700 font-semibold">{title}</p>
        {goalValue && (
          <span className="text-xs text-gray-400">goal: {fmt(goalValue)} {unit}</span>
        )}
      </div>

      <div className="relative flex items-end gap-1.5 h-28">
        {goalPct !== null && (
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none"
            style={{ bottom: `${goalPct}%` }}
          >
            <div className="flex-1 border-t-2 border-dashed border-gray-300" />
          </div>
        )}

        {values.map((v, i) => {
          const heightPct  = v > 0 ? Math.max((v / cap) * 100, 5) : 0;
          const isToday    = i === values.length - 1;
          const dk         = days[i].dateKey;
          const isSelected = selectedDayKey === dk;

          return (
            <div
              key={i}
              className={`flex-1 flex flex-col items-center justify-end gap-0.5 ${onDayClick ? 'cursor-pointer' : ''}`}
              onClick={() => onDayClick?.(dk)}
            >
              {v > 0 && (
                <span className={`text-xs leading-none ${isSelected ? 'font-bold text-gray-700' : 'text-gray-400'}`}>
                  {fmt(v)}
                </span>
              )}
              <div
                className={`w-full rounded-t-md transition-all ${
                  isToday ? color.replace('300', '500') : color
                } ${v === 0 ? 'opacity-10' : ''} ${isSelected ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                style={{ height: `${heightPct}%`, minHeight: v > 0 ? '6px' : '2px' }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex mt-1.5">
        {days.map((d, i) => (
          <span
            key={i}
            className={`flex-1 text-center text-xs truncate ${
              i === days.length - 1 ? 'text-blue-600 font-semibold' : 'text-gray-400'
            } ${selectedDayKey === d.dateKey ? 'font-bold underline underline-offset-2' : ''}`}
          >
            {d.label}
          </span>
        ))}
      </div>

      <p className="text-right text-xs text-gray-300 mt-0.5">{unit}</p>
    </div>
  );
}

// ─── Exercise Row ─────────────────────────────────────────────────────────────

function ExerciseRow({
  days, selectedDayKey, onDayClick,
}: {
  days: DaySummary[];
  selectedDayKey?: string | null;
  onDayClick?: (dk: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-gray-700 font-semibold mb-3">💪 Exercise</p>
      <div className="flex justify-between gap-1">
        {days.map((d, i) => {
          const isToday    = i === days.length - 1;
          const active     = d.exerciseCount > 0;
          const isSelected = selectedDayKey === d.dateKey;
          return (
            <div
              key={i}
              className={`flex-1 flex flex-col items-center gap-1.5 ${onDayClick ? 'cursor-pointer' : ''}`}
              onClick={() => onDayClick?.(d.dateKey)}
            >
              <div
                className={`w-full aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  active ? 'bg-green-400 text-white'
                  : isToday ? 'bg-blue-50 border-2 border-blue-200 text-blue-300'
                  : 'bg-gray-100 text-gray-300'
                } ${isSelected ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
              >
                {active ? '✓' : '·'}
              </div>
              <span className={`text-xs truncate ${
                isToday ? 'text-blue-600 font-semibold' : 'text-gray-400'
              } ${isSelected ? 'font-bold underline underline-offset-2' : ''}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mood Chart ───────────────────────────────────────────────────────────────

function MoodChart({ days }: { days: DaySummary[] }) {
  const hasMoodData = days.some((d) => d.moodScore !== null);
  if (!hasMoodData) return null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-700 font-semibold">🧠 Mood</p>
        <span className="text-xs text-gray-400">scale: 1–10</span>
      </div>

      <div className="flex items-end gap-1.5 h-28">
        {days.map((d, i) => {
          const score     = d.moodScore;
          const isToday   = i === days.length - 1;
          const heightPct = score !== null ? Math.max((score / 10) * 100, 5) : 0;
          const barColor  = score !== null
            ? (isToday ? moodBarColorToday(score) : moodBarColor(score))
            : '';
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              {score !== null && (
                <span className="text-xs text-gray-400 leading-none">{score.toFixed(1)}</span>
              )}
              <div
                className={`w-full rounded-t-md transition-all ${score !== null ? barColor : 'bg-gray-100 opacity-30'}`}
                style={{ height: score !== null ? `${heightPct}%` : '2px', minHeight: score !== null ? '6px' : '2px' }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex mt-1.5">
        {days.map((d, i) => (
          <span key={i} className="flex-1 text-center text-xs">
            {d.moodScore !== null ? moodEmoji(d.moodScore) : ''}
          </span>
        ))}
      </div>
      <div className="flex mt-0.5">
        {days.map((d, i) => (
          <span key={i} className={`flex-1 text-center text-xs truncate ${
            i === days.length - 1 ? 'text-blue-600 font-semibold' : 'text-gray-400'
          }`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SummaryPage() {
  const router = useRouter();
  const [userId,  setUserId]  = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<RawEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { goals } = useGoals(userId);

  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);
  const [selectedExDay,  setSelectedExDay]  = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
      else setUserId(data.user.id);
    });
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/summary?userId=${userId}&days=7`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEntries(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const days = useMemo<DaySummary[]>(() => {
    return getLast7Days().map((date) => {
      const key        = dateKey(date);
      const dayEntries = entries.filter((e) => e.occurred_at.startsWith(key));

      const calories = dayEntries
        .filter((e) => e.category === 'food')
        .reduce((s, e) => s + ((e.parsed_data as FoodData).calories ?? 0), 0);

      const waterOz = dayEntries
        .filter((e) => e.category === 'health' && (e.parsed_data as HealthData).metricType === 'water')
        .reduce((s, e) => s + ((e.parsed_data as HealthData).value ?? 0), 0);

      const sleepEntry = dayEntries
        .filter((e) => e.category === 'health' && (e.parsed_data as HealthData).metricType === 'sleep')
        .at(-1);
      const sleepHrs = sleepEntry ? ((sleepEntry.parsed_data as HealthData).value ?? 0) : 0;

      const exerciseCount = dayEntries.filter((e) => e.category === 'exercise').length;

      const moodEntries = dayEntries.filter(
        (e) => e.category === 'health' && (e.parsed_data as HealthData).metricType === 'mood'
      );
      const moodScore = moodEntries.length > 0
        ? moodEntries.reduce((sum, e) => sum + ((e.parsed_data as HealthData).value ?? 5), 0) / moodEntries.length
        : null;

      return { date, dateKey: key, label: shortDay(date), calories, waterOz, sleepHrs, exerciseCount, moodScore };
    });
  }, [entries]);

  const maxCalories = Math.max(...days.map((d) => d.calories), goals.daily_calories, 1);
  const maxWater    = Math.max(...days.map((d) => d.waterOz),  goals.daily_water_oz,  1);
  const maxSleep    = Math.max(...days.map((d) => d.sleepHrs), goals.sleep_hours,     10);

  const calDayLabel = selectedCalDay ? (days.find((d) => d.dateKey === selectedCalDay)?.label ?? selectedCalDay) : '';
  const exDayLabel  = selectedExDay  ? (days.find((d) => d.dateKey === selectedExDay)?.label  ?? selectedExDay)  : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const hasAnyData = days.some(
    (d) => d.calories > 0 || d.waterOz > 0 || d.sleepHrs > 0 || d.exerciseCount > 0 || d.moodScore !== null
  );

  return (
    <div className="px-4 pt-6 space-y-4 pb-8">
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
          {/* Calories + drill-down */}
          <BarChart
            title="🍽️ Calories"
            days={days}
            values={days.map((d) => d.calories)}
            maxValue={maxCalories}
            color="bg-blue-300"
            todayColor="bg-blue-500"
            unit="cal"
            goalValue={goals.daily_calories}
            selectedDayKey={selectedCalDay}
            onDayClick={(dk) => setSelectedCalDay((prev) => (prev === dk ? null : dk))}
          />
          {selectedCalDay && (
            <CalorieDetail
              dateKey={selectedCalDay}
              dayLabel={calDayLabel}
              entries={entries}
              onClose={() => setSelectedCalDay(null)}
            />
          )}

          {/* Water */}
          <BarChart
            title="💧 Water"
            days={days}
            values={days.map((d) => d.waterOz)}
            maxValue={maxWater}
            color="bg-cyan-300"
            todayColor="bg-cyan-500"
            unit="oz"
            goalValue={goals.daily_water_oz}
          />

          {/* Sleep */}
          <BarChart
            title="😴 Sleep"
            days={days}
            values={days.map((d) => d.sleepHrs)}
            maxValue={maxSleep}
            color="bg-purple-300"
            todayColor="bg-purple-500"
            unit="hrs"
            goalValue={goals.sleep_hours}
            formatVal={(v) => v.toFixed(1)}
          />

          {/* Exercise + drill-down */}
          <ExerciseRow
            days={days}
            selectedDayKey={selectedExDay}
            onDayClick={(dk) => setSelectedExDay((prev) => (prev === dk ? null : dk))}
          />
          {selectedExDay && (
            <ExerciseDetail
              dateKey={selectedExDay}
              dayLabel={exDayLabel}
              entries={entries}
              onClose={() => setSelectedExDay(null)}
            />
          )}

          {/* Mood */}
          <MoodChart days={days} />
        </>
      )}
    </div>
  );
}

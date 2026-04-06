'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useEntries } from '@/hooks/useEntries';
import { useGoals, Goals } from '@/hooks/useGoals';
import { HealthData, FoodData } from '@/lib/types';

// ─── Color themes per metric ───────────────────────────────────────────────
const COLORS = {
  blue:   { bar: 'bg-blue-500',   text: 'text-blue-600',   border: 'border-blue-300',   bg: 'bg-blue-50'   },
  cyan:   { bar: 'bg-cyan-500',   text: 'text-cyan-600',   border: 'border-cyan-300',   bg: 'bg-cyan-50'   },
  purple: { bar: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-300', bg: 'bg-purple-50' },
  green:  { bar: 'bg-green-500',  text: 'text-green-600',  border: 'border-green-300',  bg: 'bg-green-50'  },
} as const;

type ColorKey = keyof typeof COLORS;

// ─── Goal progress card ─────────────────────────────────────────────────────
interface GoalCardProps {
  emoji: string;
  label: string;
  sublabel?: string;
  current: number;
  target: number;
  unit: string;
  color: ColorKey;
  editing: boolean;
  onTargetChange: (v: number) => void;
  step?: number;
  decimal?: boolean;
}

function GoalCard({
  emoji, label, sublabel, current, target, unit,
  color, editing, onTargetChange, step = 1, decimal = false,
}: GoalCardProps) {
  const c = COLORS[color];
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const displayCurrent = decimal ? current.toFixed(1) : Math.round(current);
  const displayTarget  = decimal ? target : Math.round(target);
  const reached = current >= target && target > 0;

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100`}>
      <div className="flex items-center justify-between mb-3">
        {/* Left: emoji + label */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <div>
            <p className="text-gray-800 font-semibold leading-tight">{label}</p>
            {sublabel && <p className="text-gray-400 text-xs">{sublabel}</p>}
          </div>
        </div>

        {/* Right: target editor or progress */}
        {editing ? (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-sm">Target:</span>
            <input
              type="number"
              value={decimal ? target : Math.round(target)}
              step={step}
              min={0}
              onChange={(e) => onTargetChange(parseFloat(e.target.value) || 0)}
              className={`w-20 text-center border-2 ${c.border} rounded-lg py-1 font-bold ${c.text} focus:outline-none focus:ring-2 focus:ring-offset-1`}
            />
            <span className="text-gray-400 text-sm">{unit}</span>
          </div>
        ) : (
          <span className={`text-sm font-semibold ${reached ? 'text-green-600' : c.text}`}>
            {reached ? '✓ ' : ''}{displayCurrent} / {displayTarget} {unit}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${reached ? 'bg-green-400' : c.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-xs text-gray-400 mt-1">{Math.round(pct)}%</p>
    </div>
  );
}

// ─── Exercise weekly dots ────────────────────────────────────────────────────
function ExerciseCard({
  weekCount, target, editing, onTargetChange,
}: {
  weekCount: number;
  target: number;
  editing: boolean;
  onTargetChange: (v: number) => void;
}) {
  const reached = weekCount >= target;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💪</span>
          <div>
            <p className="text-gray-800 font-semibold leading-tight">Exercise days</p>
            <p className="text-gray-400 text-xs">this week</p>
          </div>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-sm">Target:</span>
            <input
              type="number"
              min={1}
              max={7}
              value={Math.round(target)}
              onChange={(e) => onTargetChange(parseInt(e.target.value) || 4)}
              className="w-12 text-center border-2 border-green-300 rounded-lg py-1 font-bold text-green-600 focus:outline-none"
            />
            <span className="text-gray-400 text-sm">days/wk</span>
          </div>
        ) : (
          <span className={`text-sm font-semibold ${reached ? 'text-green-600' : 'text-green-600'}`}>
            {reached ? '✓ ' : ''}{weekCount} / {Math.round(target)} days
          </span>
        )}
      </div>

      {/* Day dots */}
      <div className="flex gap-2">
        {Array.from({ length: Math.round(target) }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-3 rounded-full transition-colors ${
              i < weekCount ? 'bg-green-400' : 'bg-gray-100'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const router = useRouter();
  const [userId, setUserId]       = useState<string | undefined>(undefined);
  const [editing, setEditing]     = useState(false);
  const [draft, setDraft]         = useState<Goals | null>(null);
  const [weekExercise, setWeekExercise] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError]  = useState(false);

  const { entries, loading: entriesLoading } = useEntries(userId);
  const { goals, loading: goalsLoading, saving, saveGoals } = useGoals(userId);

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
      else setUserId(data.user.id);
    });
  }, [router]);

  // Fetch this week's exercise count (Sunday→today)
  useEffect(() => {
    if (!userId) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    supabase
      .from('entries')
      .select('id')
      .eq('user_id', userId)
      .eq('category', 'exercise')
      .gte('occurred_at', weekStart.toISOString())
      .then(({ data }) => setWeekExercise(data?.length ?? 0));
  }, [userId]);

  // ── Derive today's totals from entries ─────────────────────────────────────
  const totalCalories = entries
    .filter((e) => e.category === 'food')
    .reduce((sum, e) => sum + ((e.parsed_data as FoodData).calories ?? 0), 0);

  const totalWaterOz = entries
    .filter(
      (e) =>
        e.category === 'health' &&
        (e.parsed_data as HealthData).metricType === 'water'
    )
    .reduce((sum, e) => sum + ((e.parsed_data as HealthData).value ?? 0), 0);

  const lastSleepEntry = entries
    .filter(
      (e) =>
        e.category === 'health' &&
        (e.parsed_data as HealthData).metricType === 'sleep'
    )
    .at(0); // useEntries returns desc order
  const sleepHours = lastSleepEntry
    ? ((lastSleepEntry.parsed_data as HealthData).value ?? 0)
    : 0;

  // ── Edit handlers ──────────────────────────────────────────────────────────
  const startEdit = () => {
    setDraft({ ...goals });
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaveError(false);
    const ok = await saveGoals(draft);
    if (ok) {
      setEditing(false);
      setDraft(null);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } else {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 4000);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (goalsLoading || entriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const activeGoals = editing && draft ? draft : goals;

  return (
    <div className="px-4 pt-6 space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Goals</h1>
          <p className="text-gray-500 text-lg">Today&apos;s progress</p>
        </div>
        {!editing ? (
          <button
            onClick={startEdit}
            className="px-4 py-2 text-blue-600 border border-blue-200 rounded-xl font-medium hover:bg-blue-50 transition-colors"
          >
            Edit targets
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={cancelEdit}
              className="px-3 py-2 text-gray-500 rounded-xl font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save ✓'}
            </button>
          </div>
        )}
      </div>

      {/* Saved flash */}
      {savedFlash && (
        <div className="text-center py-2 bg-green-100 text-green-700 rounded-xl font-medium">
          ✓ Goals saved!
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="text-center py-2 bg-red-50 text-red-600 rounded-xl font-medium">
          ✗ Couldn&apos;t save goals. Please try again.
        </div>
      )}

      {/* Goal cards */}
      <GoalCard
        emoji="🍽️"
        label="Calories"
        sublabel="today"
        current={totalCalories}
        target={activeGoals.daily_calories}
        unit="cal"
        color="blue"
        editing={editing}
        step={50}
        onTargetChange={(v) => draft && setDraft({ ...draft, daily_calories: v })}
      />

      <GoalCard
        emoji="💧"
        label="Water"
        sublabel="today"
        current={totalWaterOz}
        target={activeGoals.daily_water_oz}
        unit="oz"
        color="cyan"
        editing={editing}
        step={8}
        onTargetChange={(v) => draft && setDraft({ ...draft, daily_water_oz: v })}
      />

      <GoalCard
        emoji="😴"
        label="Sleep"
        sublabel="last entry today"
        current={sleepHours}
        target={activeGoals.sleep_hours}
        unit="hrs"
        color="purple"
        editing={editing}
        step={0.5}
        decimal
        onTargetChange={(v) => draft && setDraft({ ...draft, sleep_hours: v })}
      />

      <ExerciseCard
        weekCount={weekExercise}
        target={activeGoals.exercise_days_week}
        editing={editing}
        onTargetChange={(v) => draft && setDraft({ ...draft, exercise_days_week: v })}
      />

      {/* Hint */}
      {!editing && (
        <p className="text-center text-gray-400 text-sm pt-2">
          Tap <strong>Edit targets</strong> to adjust your daily goals
        </p>
      )}
    </div>
  );
}

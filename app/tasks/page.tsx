'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Entry, TaskData } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDueTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow =
    d.toDateString() === new Date(now.getTime() + 86400000).toDateString();

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${time}`;
}

function isOverdue(iso: string): boolean {
  return new Date(iso) < new Date();
}

const CATEGORY_COLORS: Record<string, string> = {
  errand:      'bg-orange-100 text-orange-600',
  appointment: 'bg-blue-100 text-blue-600',
  chore:       'bg-yellow-100 text-yellow-700',
  personal:    'bg-purple-100 text-purple-600',
};

// ─── Task card ───────────────────────────────────────────────────────────────

function TaskCard({
  entry,
  onToggle,
  toggling,
}: {
  entry: Entry;
  onToggle: (entry: Entry) => void;
  toggling: boolean;
}) {
  const task    = entry.parsed_data as TaskData;
  const pending = task.status === 'pending';
  const overdue = pending && !!task.dueTime && isOverdue(task.dueTime);
  const catColor = task.taskCategory ? CATEGORY_COLORS[task.taskCategory] ?? 'bg-gray-100 text-gray-500' : '';

  return (
    <div
      className={`bg-white rounded-2xl px-4 py-3 shadow-sm border transition-all ${
        overdue ? 'border-red-200 bg-red-50' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Complete toggle */}
        <button
          onClick={() => onToggle(entry)}
          disabled={toggling}
          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            pending
              ? overdue
                ? 'border-red-400 hover:bg-red-100'
                : 'border-gray-300 hover:bg-gray-100'
              : 'border-green-400 bg-green-400'
          }`}
          aria-label={pending ? 'Mark complete' : 'Mark pending'}
        >
          {!pending && <span className="text-white text-xs font-bold">✓</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`font-medium leading-snug ${pending ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
            {task.taskName}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-1">
            {/* Category badge */}
            {task.taskCategory && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>
                {task.taskCategory}
              </span>
            )}

            {/* Due time */}
            {task.dueTime && (
              <span className={`text-xs font-medium flex items-center gap-1 ${
                overdue ? 'text-red-500' : 'text-gray-400'
              }`}>
                {overdue ? '⚠️ Overdue · ' : '🕐 '}{formatDueTime(task.dueTime)}
              </span>
            )}

            {/* Logged date for non-today pending tasks */}
            {pending && !entry.occurred_at.startsWith(todayKey()) && (
              <span className="text-xs text-gray-300">
                added {new Date(entry.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();
  const [userId,    setUserId]    = useState<string | undefined>(undefined);
  const [pending,   setPending]   = useState<Entry[]>([]);
  const [completed, setCompleted] = useState<Entry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [showDone,  setShowDone]  = useState(false);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
      else setUserId(data.user.id);
    });
  }, [router]);

  // Fetch tasks
  const fetchTasks = useCallback(async (uid: string) => {
    setLoading(true);

    // All pending tasks ever
    const { data: pendingData } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', uid)
      .eq('category', 'task')
      .filter('parsed_data->>status', 'eq', 'pending')
      .order('occurred_at', { ascending: true });

    // Today's completed tasks
    const { data: completedData } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', uid)
      .eq('category', 'task')
      .filter('parsed_data->>status', 'eq', 'completed')
      .gte('occurred_at', `${todayKey()}T00:00:00`)
      .order('occurred_at', { ascending: false });

    // Sort pending: overdue first (by dueTime), then no due time
    const sorted = (pendingData ?? []).sort((a, b) => {
      const aDue = (a.parsed_data as TaskData).dueTime;
      const bDue = (b.parsed_data as TaskData).dueTime;
      if (aDue && bDue) return new Date(aDue).getTime() - new Date(bDue).getTime();
      if (aDue) return -1;
      if (bDue) return 1;
      return 0;
    });

    setPending(sorted as Entry[]);
    setCompleted((completedData ?? []) as Entry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userId) fetchTasks(userId);
  }, [userId, fetchTasks]);

  // Toggle complete/pending
  const handleToggle = async (entry: Entry) => {
    const task = entry.parsed_data as TaskData;
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    setToggling(entry.id);

    const { error } = await supabase
      .from('entries')
      .update({ parsed_data: { ...task, status: newStatus } })
      .eq('id', entry.id);

    if (!error && userId) {
      await fetchTasks(userId);
    }
    setToggling(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const overdueCount = pending.filter(
    (e) => !!(e.parsed_data as TaskData).dueTime && isOverdue((e.parsed_data as TaskData).dueTime!)
  ).length;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-blue-900">Tasks</h1>
        <p className="text-gray-500 text-lg">
          {pending.length === 0
            ? 'All caught up!'
            : `${pending.length} pending${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`}
        </p>
      </div>

      {/* Pending tasks */}
      {pending.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-700 font-semibold text-lg">No pending tasks</p>
          <p className="text-gray-400 text-sm mt-1">
            Say something like &ldquo;remind me to call the doctor at 2pm&rdquo; to add one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((entry) => (
            <TaskCard
              key={entry.id}
              entry={entry}
              onToggle={handleToggle}
              toggling={toggling === entry.id}
            />
          ))}
        </div>
      )}

      {/* Completed today */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-2 text-gray-400 text-sm font-medium mb-2 hover:text-gray-600 transition-colors"
          >
            <span>{showDone ? '▾' : '▸'}</span>
            Completed today ({completed.length})
          </button>

          {showDone && (
            <div className="space-y-2">
              {completed.map((entry) => (
                <TaskCard
                  key={entry.id}
                  entry={entry}
                  onToggle={handleToggle}
                  toggling={toggling === entry.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      <p className="text-center text-gray-400 text-sm pt-2">
        Use the mic on the <strong>Today</strong> tab to add tasks by voice
      </p>
    </div>
  );
}

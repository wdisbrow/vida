'use client';
import { Entry } from '@/lib/types';
import EntryItem from './EntryItem';

interface DailyLogProps {
  entries: Entry[];
  loading: boolean;
  onDelete?: (id: string) => void;
}

export default function DailyLog({ entries, loading, onDelete }: DailyLogProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-4xl mb-3">🗒️</p>
        <p className="text-lg">Nothing logged yet today.</p>
        <p className="text-sm">Tap the mic button above to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-3">
        Today&apos;s Log
      </h2>
      {entries.map((entry) => (
        <EntryItem key={entry.id} entry={entry} onDelete={onDelete} />
      ))}
    </div>
  );
}

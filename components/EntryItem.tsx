'use client';
import { Entry } from '@/lib/types';
import { categoryEmoji, entrySummary, formatTime } from '@/lib/utils';

interface EntryItemProps {
  entry: Entry;
  onDelete?: (id: string) => void;
}

export default function EntryItem({ entry, onDelete }: EntryItemProps) {
  const emoji   = categoryEmoji(entry.category, entry.parsed_data);
  const summary = entrySummary(entry.category, entry.parsed_data);
  const time    = formatTime(entry.occurred_at);

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 group">
      <span className="text-2xl">{emoji}</span>

      <div className="flex-1 min-w-0">
        <p className="text-gray-800 font-medium truncate">{summary}</p>
        <p className="text-gray-400 text-sm">{time}</p>
      </div>

      {onDelete && (
        <button
          onClick={() => onDelete(entry.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity text-xl"
          aria-label="Delete entry"
        >
          ×
        </button>
      )}
    </div>
  );
}

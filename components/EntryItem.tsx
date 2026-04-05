'use client';
import { Entry, HealthData, TaskData } from '@/lib/types';
import { categoryEmoji, moodEmoji, moodColor, entrySummary, formatTime } from '@/lib/utils';

interface EntryItemProps {
  entry: Entry;
  onDelete?: (id: string) => void;
}

function MoodEntryItem({ entry, onDelete }: EntryItemProps) {
  const d     = entry.parsed_data as HealthData;
  const score = d.value ?? 0;
  const time  = formatTime(entry.occurred_at);
  const { bg, text, bar } = moodColor(score);

  return (
    <div className={`rounded-xl px-4 py-3 shadow-sm border border-gray-100 group ${bg}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{moodEmoji(score)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-semibold ${text}`}>Mood</p>
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full bg-white ${text}`}>
              {score}/10
            </span>
          </div>
          {d.notes && (
            <p className="text-gray-500 text-sm mt-0.5 truncate">{d.notes}</p>
          )}
          <p className="text-gray-400 text-xs mt-0.5">{time}</p>
        </div>
        {/* Score bar */}
        <div className="w-14 flex flex-col items-end gap-1">
          <div className="w-full h-2 bg-white rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${bar}`}
              style={{ width: `${score * 10}%` }}
            />
          </div>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(entry.id)}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity text-xl ml-1"
            aria-label="Delete entry"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default function EntryItem({ entry, onDelete }: EntryItemProps) {
  // Mood gets its own richer treatment
  if (
    entry.category === 'health' &&
    (entry.parsed_data as HealthData).metricType === 'mood'
  ) {
    return <MoodEntryItem entry={entry} onDelete={onDelete} />;
  }

  const emoji   = categoryEmoji(entry.category, entry.parsed_data);
  const summary = entrySummary(entry.category, entry.parsed_data);
  // For tasks with a due time, show that instead of the logging time
  const taskDueTime = entry.category === 'task'
    ? (entry.parsed_data as TaskData).dueTime
    : undefined;
  const time = taskDueTime ? formatTime(taskDueTime) : formatTime(entry.occurred_at);

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

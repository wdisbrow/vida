import { Category, ParsedData, FoodData, ExerciseData, HealthData, TaskData } from './types';

// Returns a single-line human-readable summary for an entry
export function entrySummary(category: Category, data: ParsedData): string {
  switch (category) {
    case 'food': {
      const d = data as FoodData;
      const cal = d.calories ? ` — ${d.calories} cal` : '';
      return `${d.foodName}${cal}`;
    }
    case 'exercise': {
      const d = data as ExerciseData;
      const dur = d.duration ? ` — ${d.duration} ${d.durationUnit ?? 'min'}` : '';
      const burn = d.caloriesBurned ? ` · ${d.caloriesBurned} cal burned` : '';
      return `${d.activityType}${dur}${burn}`;
    }
    case 'health': {
      const d = data as HealthData;
      if (d.metricType === 'medication') return `Took ${d.name ?? 'medication'}`;
      if (d.metricType === 'sleep') return `Slept ${d.value} ${d.unit ?? 'hours'}`;
      if (d.metricType === 'mood') return `Mood: ${d.value}/10`;
      if (d.metricType === 'weight') return `Weight: ${d.value} ${d.unit ?? 'lbs'}`;
      if (d.metricType === 'water') return `Water: ${d.value} ${d.unit ?? 'oz'}`;
      if (d.metricType === 'blood_pressure') return `BP: ${d.value} ${d.unit ?? ''}`.trim();
      if (d.metricType === 'symptom') return d.notes ? `Note: ${d.notes}` : 'Health note';
      return d.notes ?? d.metricType;
    }
    case 'task': {
      const d = data as TaskData;
      return d.taskName;
    }
    default:
      return '';
  }
}

// Returns a score-based mood emoji (1–10 scale)
export function moodEmoji(score: number): string {
  if (score <= 2)  return '😢';
  if (score <= 4)  return '😕';
  if (score <= 6)  return '😐';
  if (score <= 8)  return '🙂';
  return '😄';
}

// Returns Tailwind color classes for a mood score
export function moodColor(score: number): { bg: string; text: string; bar: string } {
  if (score <= 2)  return { bg: 'bg-red-50',    text: 'text-red-500',    bar: 'bg-red-400' };
  if (score <= 4)  return { bg: 'bg-orange-50', text: 'text-orange-500', bar: 'bg-orange-400' };
  if (score <= 6)  return { bg: 'bg-yellow-50', text: 'text-yellow-600', bar: 'bg-yellow-400' };
  if (score <= 8)  return { bg: 'bg-green-50',  text: 'text-green-600',  bar: 'bg-green-400' };
  return              { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-400' };
}

// Returns an emoji for each category / health metric type
export function categoryEmoji(category: Category, data?: ParsedData): string {
  switch (category) {
    case 'food':     return '🍽️';
    case 'exercise': return '💪';
    case 'task':     return '✅';
    case 'health': {
      const d = data as HealthData | undefined;
      if (!d) return '❤️';
      switch (d.metricType) {
        case 'sleep':          return '😴';
        case 'mood':           return moodEmoji((d.value ?? 5));
        case 'weight':         return '⚖️';
        case 'water':          return '💧';
        case 'medication':     return '💊';
        case 'blood_pressure': return '🩺';
        default:               return '❤️';
      }
    }
    default: return '📝';
  }
}

// Format a Date as "Tuesday, March 31"
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Format a timestamp as "8:30 AM"
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

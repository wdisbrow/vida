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
        case 'sleep':       return '😴';
        case 'mood':        return '😊';
        case 'weight':      return '⚖️';
        case 'water':       return '💧';
        case 'medication':  return '💊';
        case 'blood_pressure': return '🩺';
        default:            return '❤️';
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

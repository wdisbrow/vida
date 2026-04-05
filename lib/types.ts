export type Category = 'food' | 'exercise' | 'health' | 'task';

export interface FoodData {
  foodName: string;
  quantity?: string;
  grams?: number;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface ExerciseData {
  activityType: string;
  duration?: number;
  durationUnit?: string;
  intensity?: 'light' | 'moderate' | 'vigorous';
  caloriesBurned?: number;
  metValue?: number;
}

export interface HealthData {
  metricType: 'sleep' | 'mood' | 'weight' | 'blood_pressure' | 'medication' | 'symptom' | 'water';
  value?: number;
  unit?: string;
  notes?: string;
  taken?: boolean;   // for medications
  name?: string;     // for medications
}

export interface TaskData {
  taskName: string;
  status: 'completed' | 'pending';
  taskCategory?: string;
  dueTime?: string; // ISO 8601 timestamp — set when user mentions a specific time
}

export type ParsedData = FoodData | ExerciseData | HealthData | TaskData;

export interface Entry {
  id: string;
  user_id: string;
  created_at: string;
  occurred_at: string;
  category: Category;
  raw_text: string;
  parsed_data: ParsedData;
  confidence: number;
  source: 'voice' | 'manual';
}

// What Claude returns after parsing a voice entry
export interface ParseResult {
  category: Category;
  occurred_at: string;
  parsed_data: ParsedData;
  confidence: number;
  needs_clarification: boolean;
  clarification_prompt?: string;
  display_summary: string; // e.g. "Oatmeal with berries — 320 cal"
}

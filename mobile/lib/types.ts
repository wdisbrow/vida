export type Category = 'food' | 'exercise' | 'health' | 'task'

export interface Entry {
  id: string
  user_id: string
  created_at: string
  occurred_at: string
  category: Category
  raw_text: string
  parsed_data: ParsedData
  confidence: number
  source: string
}

// Matches the actual fields returned by /api/parse-entry
export interface ParsedData {
  // Food
  foodName?: string
  quantity?: string
  grams?: number
  mealType?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number

  // Exercise
  activityType?: string
  duration?: number
  durationUnit?: 'minutes' | 'hours'
  intensity?: string
  caloriesBurned?: number
  metValue?: number

  // Health — all health types share metricType + value + unit
  metricType?: 'sleep' | 'mood' | 'weight' | 'blood_pressure' | 'medication' | 'symptom' | 'water'
  value?: number
  unit?: string
  notes?: string
  taken?: boolean
  name?: string

  // Task
  taskName?: string
  status?: 'completed' | 'pending'
  taskCategory?: string
  dueTime?: string

  // Metadata stored alongside parsed fields
  display_summary?: string
}

export interface Goals {
  id: string
  user_id: string
  daily_calories: number
  daily_water_oz: number
  sleep_hours: number
  exercise_days_week: number
}

export interface Profile {
  id: string
  full_name: string
  weight_lbs: number
  timezone: string
}

export interface DayStats {
  date: string
  calories: number
  water_oz: number
  exercise_minutes: number
  sleep_hours: number
  mood: number
  workouts: number
}

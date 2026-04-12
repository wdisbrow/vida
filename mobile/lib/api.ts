import { supabase } from './supabase'
import { Entry, Goals, Profile, DayStats, ParsedData } from './types'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://vida-navy.vercel.app'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildLocalISO(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const tzOffset = now.getTimezoneOffset()
  const sign = tzOffset > 0 ? '-' : '+'
  const absOff = Math.abs(tzOffset)
  const localNow = new Date(now.getTime() - tzOffset * 60000)
  return localNow.toISOString().slice(0, 19)
    + `${sign}${pad(Math.floor(absOff / 60))}:${pad(absOff % 60)}`
}

// Returns a local date string (YYYY-MM-DD) for N days ago
function localDateStr(daysAgo = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const tz = d.getTimezoneOffset()
  return new Date(d.getTime() - tz * 60000).toISOString().split('T')[0]
}

function durationMinutes(entry: Entry): number {
  const p = entry.parsed_data
  if (!p.duration) return 0
  return p.durationUnit === 'hours' ? p.duration * 60 : p.duration
}

// ── Voice: transcribe audio ───────────────────────────────────────────────────

export async function transcribeAudio(audioUri: string): Promise<string> {
  const formData = new FormData()
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as any)

  const response = await fetch(`${API_BASE}/api/transcribe`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) throw new Error(`Transcription failed: ${await response.text()}`)
  const data = await response.json()
  return data.transcript || ''
}

// ── Voice: parse transcript ───────────────────────────────────────────────────

export async function parseTranscript(
  transcript: string
): Promise<{ category: string; parsed_data: ParsedData; occurred_at: string; confidence: number; display_summary: string }> {
  const profile = await getProfile()

  const response = await fetch(`${API_BASE}/api/parse-entry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      datetime: buildLocalISO(),
      weightLbs: profile?.weight_lbs || 140,
    }),
  })

  if (!response.ok) throw new Error(`Parse failed: ${await response.text()}`)
  return response.json()
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function saveEntry(
  category: string,
  rawText: string,
  parsedData: ParsedData,
  occurredAt?: string,
  confidence?: number
): Promise<Entry> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) throw new Error('Not authenticated')

  const response = await fetch(`${API_BASE}/api/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id,
      category,
      raw_text: rawText,
      parsed_data: parsedData,
      occurred_at: occurredAt || new Date().toISOString(),
      confidence: confidence ?? 1.0,
      source: 'voice',
    }),
  })

  if (!response.ok) throw new Error(`Save failed: ${await response.text()}`)
  return response.json()
}

export async function getTodayEntries(targetDate?: string): Promise<Entry[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return []

  const tzOffset = new Date().getTimezoneOffset()
  const date = targetDate || localDateStr(0)
  const response = await fetch(`${API_BASE}/api/entries?userId=${user.id}&date=${date}&tzOffset=${tzOffset}`)
  if (!response.ok) return []
  return response.json()
}

export async function deleteEntry(entryId: string): Promise<void> {
  await fetch(`${API_BASE}/api/entries?id=${entryId}`, { method: 'DELETE' })
}

// ── Tasks (all dates, not just today) ─────────────────────────────────────────

export async function updateTaskStatus(entry: Entry, newStatus: string): Promise<void> {
  const updatedParsedData = { ...entry.parsed_data, status: newStatus }
  const { error } = await supabase
    .from('entries')
    .update({ parsed_data: updatedParsedData })
    .eq('id', entry.id)
  if (error) throw error
}

export async function getAllTasks(): Promise<Entry[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return []

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('category', 'task')
    .order('occurred_at', { ascending: true })

  if (error) {
    console.error('getAllTasks error:', error)
    return []
  }
  return data || []
}

// ── Today stats ───────────────────────────────────────────────────────────────

export async function getTodayStats(targetDate?: string) {
  const entries = await getTodayEntries(targetDate)

  let calories = 0
  let water_oz = 0
  let exercise_minutes = 0
  let sleep_hours = 0
  let workouts = 0

  for (const entry of entries) {
    const p = entry.parsed_data
    if (entry.category === 'food') {
      calories += p.calories || 0
    } else if (entry.category === 'exercise') {
      const mins = durationMinutes(entry)
      exercise_minutes += mins
      if (mins > 5) workouts++
    } else if (entry.category === 'health') {
      if (p.metricType === 'water') water_oz += p.value || 0
      if (p.metricType === 'sleep') sleep_hours += p.value || 0
    }
  }

  return { calories, water_oz, exercise_minutes, sleep_hours, workouts }
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function getGoals(): Promise<Goals | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  const response = await fetch(`${API_BASE}/api/goals?userId=${user.id}`)
  if (!response.ok) return null
  const data = await response.json()
  return data.error ? null : data
}

export async function upsertGoals(goals: Partial<Goals>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) throw new Error('Not authenticated')

  const response = await fetch(`${API_BASE}/api/goals`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, ...goals }),
  })
  if (!response.ok) throw new Error(`Goals save failed: ${await response.text()}`)
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data || null
}

// ── 7-day summary ─────────────────────────────────────────────────────────────

export async function getWeekStats(weekOffset = 0): Promise<DayStats[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return []

  const tzOffset = new Date().getTimezoneOffset()
  // Build 7 days ending (weekOffset * 7) days ago, using local dates
  const days: Record<string, DayStats> = {}
  for (let i = 6; i >= 0; i--) {
    const key = localDateStr(i + weekOffset * 7)
    days[key] = { date: key, calories: 0, water_oz: 0, exercise_minutes: 0, sleep_hours: 0, mood: 0, workouts: 0 }
  }

  const moodCounts: Record<string, number> = {}

  await Promise.all(Object.keys(days).map(async (date) => {
    const response = await fetch(`${API_BASE}/api/entries?userId=${user.id}&date=${date}&tzOffset=${tzOffset}`)
    if (!response.ok) return
    const entries: Entry[] = await response.json()

    for (const entry of entries) {
      const p = entry.parsed_data
      if (entry.category === 'food') {
        days[date].calories += p.calories || 0
      } else if (entry.category === 'exercise') {
        const mins = p.durationUnit === 'hours' ? (p.duration || 0) * 60 : (p.duration || 0)
        days[date].exercise_minutes += mins
        if (mins > 5) days[date].workouts++
      } else if (entry.category === 'health') {
        if (p.metricType === 'water') days[date].water_oz += p.value || 0
        if (p.metricType === 'sleep') days[date].sleep_hours += p.value || 0
        if (p.metricType === 'mood' && p.value) {
          days[date].mood += p.value
          moodCounts[date] = (moodCounts[date] || 0) + 1
        }
      }
    }
  }))

  for (const key of Object.keys(days)) {
    if (moodCounts[key]) days[key].mood = days[key].mood / moodCounts[key]
  }

  return Object.values(days)
}

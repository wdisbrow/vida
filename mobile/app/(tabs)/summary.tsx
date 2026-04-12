import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Dimensions, ActivityIndicator,
  TouchableOpacity, Modal, PanResponder,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BarChart } from 'react-native-chart-kit'
import { getWeekStats, getGoals } from '@/lib/api'
import { DayStats, Goals, Entry } from '@/lib/types'
import { supabase } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://vida-navy.vercel.app'
const SCREEN_WIDTH = Dimensions.get('window').width

const MOOD_EMOJI = ['', '😞', '😟', '😐', '🙂', '😊', '😄', '😁', '🤩', '🥳', '🎉']
const MOOD_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

const CATEGORY_COLORS: Record<string, string> = {
  food: '#10b981', exercise: '#f59e0b', health: '#3b82f6', task: '#8b5cf6',
}
const CATEGORY_ICONS: Record<string, string> = {
  food: '🍎', exercise: '💪', health: '❤️', task: '✅',
}
const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎',
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const isToday = dateStr === new Date().toISOString().split('T')[0]
  return isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })
}

function moodColor(mood: number) {
  if (!mood) return '#e5e7eb'
  return MOOD_COLORS[Math.min(Math.floor(mood / 2.5), 4)] || '#22c55e'
}

function entryTitle(entry: Entry): string {
  const p = entry.parsed_data
  if (p.display_summary) return p.display_summary
  switch (entry.category) {
    case 'food': return p.foodName || entry.raw_text
    case 'exercise': return p.activityType || entry.raw_text
    case 'health':
      if (p.metricType === 'sleep') return `Sleep: ${p.value}h`
      if (p.metricType === 'mood') return `Mood: ${p.value}/10`
      if (p.metricType === 'water') return `Water: ${p.value} ${p.unit || 'oz'}`
      return p.notes || entry.raw_text
    case 'task': return p.taskName || entry.raw_text
    default: return entry.raw_text
  }
}

function entryDetail(entry: Entry): string {
  const p = entry.parsed_data
  const parts: string[] = []
  if (entry.category === 'food') {
    if (p.calories) parts.push(`${p.calories} cal`)
    if (p.protein) parts.push(`${p.protein}g protein`)
    if (p.quantity) parts.push(p.quantity)
  } else if (entry.category === 'exercise') {
    if (p.duration) parts.push(`${p.duration} ${p.durationUnit || 'min'}`)
    if (p.intensity) parts.push(p.intensity)
    if (p.caloriesBurned) parts.push(`${p.caloriesBurned} cal burned`)
  }
  return parts.join(' · ')
}

// ── Day detail modal ──────────────────────────────────────────────────────────

function DayDetailModal({
  date, category, visible, onClose,
}: { date: string; category: string; visible: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!date || !visible) return
    setLoading(true)
    setEntries([])
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (!user) { setLoading(false); return }
      fetch(`${API_BASE}/api/entries?userId=${user.id}&date=${date}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setEntries(data))
        .finally(() => setLoading(false))
    })
  }, [date, visible])

  // Filter to the relevant category (health covers water/sleep/mood)
  const filtered = entries.filter(e => e.category === category)

  const label = dayLabel(date)

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modal.safe}>
        <View style={modal.header}>
          <Text style={modal.title}>{label}</Text>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Text style={modal.closeText}>Done</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={modal.center}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={modal.center}>
            <Text style={modal.emptyIcon}>📭</Text>
            <Text style={modal.emptyText}>No {category} entries logged this day</Text>
          </View>
        ) : (
          <ScrollView style={modal.scroll} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View style={[modal.section, { borderLeftColor: CATEGORY_COLORS[category] }]}>
              <Text style={[modal.sectionTitle, { color: CATEGORY_COLORS[category] }]}>
                {CATEGORY_ICONS[category]} {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
              {filtered.map((entry, i) => {
                const time = new Date(entry.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                const detail = entryDetail(entry)
                const p = entry.parsed_data
                const color = CATEGORY_COLORS[category]
                return (
                  <View key={i} style={modal.entryRow}>
                    <View style={modal.entryLeft}>
                      {category === 'food' && p.mealType && (
                        <Text style={modal.mealIcon}>{MEAL_ICONS[p.mealType] || '🍎'}</Text>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={modal.entryTitle}>{entryTitle(entry)}</Text>
                        {detail ? <Text style={modal.entryDetail}>{detail}</Text> : null}
                        <Text style={modal.entryTime}>{time}</Text>
                      </View>
                    </View>
                    {category === 'food' && p.calories ? (
                      <Text style={[modal.entryValue, { color }]}>{p.calories} cal</Text>
                    ) : category === 'exercise' && p.duration ? (
                      <Text style={[modal.entryValue, { color }]}>{p.duration} {p.durationUnit || 'min'}</Text>
                    ) : category === 'health' && p.value ? (
                      <Text style={[modal.entryValue, { color }]}>{p.value} {p.unit || ''}</Text>
                    ) : null}
                  </View>
                )
              })}

              {/* Totals */}
              {category === 'food' && (
                <View style={modal.total}>
                  <Text style={modal.totalText}>
                    {filtered.reduce((s, e) => s + (e.parsed_data.calories || 0), 0)} cal total
                  </Text>
                </View>
              )}
              {category === 'exercise' && (
                <View style={modal.total}>
                  <Text style={modal.totalText}>
                    {filtered.reduce((s, e) => {
                      const p = e.parsed_data
                      return s + (p.durationUnit === 'hours' ? (p.duration || 0) * 60 : (p.duration || 0))
                    }, 0)} min total
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  )
}

// ── Chart section ─────────────────────────────────────────────────────────────

function ChartSection({ title, data, labels, dates, color, unit, goalLine, category, onDayPress }: {
  title: string; data: number[]; labels: string[]; dates: string[]
  color: string; unit: string; goalLine?: number; category: string
  onDayPress: (date: string, category: string) => void
}) {
  // truncate labels to 3 chars for chart display
  const chartLabels = labels.map(l => l.slice(0, 3))
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        {goalLine ? <Text style={[styles.goalTag, { color }]}>Goal: {goalLine} {unit}</Text> : null}
      </View>
      <BarChart
        data={{ labels: chartLabels, datasets: [{ data: data.map(v => v || 0) }] }}
        width={SCREEN_WIDTH - 64}
        height={160}
        yAxisLabel="" yAxisSuffix=""
        chartConfig={{
          backgroundColor: '#fff', backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff',
          decimalPlaces: 0,
          color: (opacity = 1) => `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
          labelColor: () => '#9ca3af', barPercentage: 0.6,
          fillShadowGradient: color, fillShadowGradientOpacity: 1,
          propsForBackgroundLines: { stroke: '#f3f4f6', strokeWidth: 1 },
        }}
        style={{ borderRadius: 12, marginTop: 8 }}
        withInnerLines showBarTops={false} fromZero
      />
      {/* Tappable day buttons for drill-down */}
      <View style={styles.dayButtons}>
        {dates.map((date, i) => (
          <TouchableOpacity key={date} style={[styles.dayBtn, data[i] > 0 && { backgroundColor: color + '18' }]} onPress={() => onDayPress(date, category)}>
            <Text style={[styles.dayBtnLabel, { color: data[i] > 0 ? color : '#9ca3af' }]}>{labels[i]}</Text>
            <Text style={[styles.dayBtnValue, { color: data[i] > 0 ? color : '#d1d5db' }]}>
              {data[i] > 0 ? data[i] : '—'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SummaryScreen() {
  const [days, setDays] = useState<DayStats[]>([])
  const [goals, setGoals] = useState<Goals | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ date: string; category: string } | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)

  async function load(offset = 0) {
    try {
      const [d, g] = await Promise.all([getWeekStats(offset), getGoals()])
      setDays(d)
      setGoals(g)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(useCallback(() => { load(weekOffset) }, [weekOffset]))

  function goBack() {
    setWeekOffset(o => o + 1)
    setLoading(true)
  }
  function goForward() {
    if (weekOffset === 0) return
    setWeekOffset(o => o - 1)
    setLoading(true)
  }

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -40) goBack()
      else if (gs.dx > 40) goForward()
    },
  })).current

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    )
  }

  const _end = new Date()
  _end.setDate(_end.getDate() - weekOffset * 7)
  const _start = new Date(_end)
  _start.setDate(_end.getDate() - 6)
  const _fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dateRangeLabel = _start.getMonth() === _end.getMonth()
    ? `${_fmt(_start)} \u2013 ${_end.getDate()}`
    : `${_fmt(_start)} \u2013 ${_fmt(_end)}`

  const labels = days.map(d => dayLabel(d.date))
  const dates = days.map(d => d.date)
  const calories = days.map(d => d.calories)
  const water = days.map(d => d.water_oz)
  const exercise = days.map(d => d.exercise_minutes)
  const sleep = days.map(d => d.sleep_hours)

  const avgCalories = Math.round(calories.reduce((a, b) => a + b, 0) / (days.filter(d => d.calories > 0).length || 1))
  const avgWater = Math.round(water.reduce((a, b) => a + b, 0) / (days.filter(d => d.water_oz > 0).length || 1))
  const totalWorkouts = days.reduce((a, d) => a + d.workouts, 0)
  const avgSleep = (sleep.reduce((a, b) => a + b, 0) / (days.filter(d => d.sleep_hours > 0).length || 1)).toFixed(1)

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll}>
        <View style={styles.header} {...panResponder.panHandlers}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={goBack} style={styles.chevron}>
              <Text style={styles.chevronText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>{dateRangeLabel}</Text>
              <Text style={styles.sub}>
                {weekOffset === 0 ? 'Tap any bar for day details' : `${weekOffset * 7} days ago  ·  swipe to navigate`}
              </Text>
            </View>
            <TouchableOpacity onPress={goForward} style={styles.chevron} disabled={weekOffset === 0}>
              <Text style={[styles.chevronText, weekOffset === 0 && styles.chevronDisabled]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Avg Calories', value: `${avgCalories}`, unit: 'kcal', color: '#ef4444' },
            { label: 'Avg Water', value: `${avgWater}`, unit: 'oz', color: '#3b82f6' },
            { label: 'Workouts', value: `${totalWorkouts}`, unit: 'total', color: '#f59e0b' },
            { label: 'Avg Sleep', value: `${avgSleep}`, unit: 'hrs', color: '#8b5cf6' },
          ].map(stat => (
            <View key={stat.label} style={[styles.miniStat, { borderTopColor: stat.color }]}>
              <Text style={[styles.miniStatValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.miniStatUnit}>{stat.unit}</Text>
              <Text style={styles.miniStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.charts}>
          <ChartSection
            title="🔥 Calories" data={calories} labels={labels} dates={dates}
            color="#ef4444" unit="kcal" goalLine={goals?.daily_calories}
            category="food" onDayPress={(d, c) => setSelected({ date: d, category: c })}
          />
          <ChartSection
            title="💧 Water" data={water} labels={labels} dates={dates}
            color="#3b82f6" unit="oz" goalLine={goals?.daily_water_oz}
            category="health" onDayPress={(d, c) => setSelected({ date: d, category: c })}
          />
          <ChartSection
            title="💪 Exercise" data={exercise} labels={labels} dates={dates}
            color="#f59e0b" unit="min"
            category="exercise" onDayPress={(d, c) => setSelected({ date: d, category: c })}
          />
          <ChartSection
            title="😴 Sleep" data={sleep} labels={labels} dates={dates}
            color="#8b5cf6" unit="hrs" goalLine={goals?.sleep_hours}
            category="health" onDayPress={(d, c) => setSelected({ date: d, category: c })}
          />

          {/* Mood chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>🌈 Mood</Text>
            <View style={styles.moodRow}>
              {days.map((d, i) => (
                <TouchableOpacity key={i} style={styles.moodCol} onPress={() => setSelected({ date: d.date, category: 'health' })}>
                  <Text style={styles.moodEmoji}>{d.mood > 0 ? MOOD_EMOJI[Math.round(d.mood)] || '' : ''}</Text>
                  <View style={[styles.moodBar, {
                    height: d.mood > 0 ? Math.max(d.mood * 8, 8) : 4,
                    backgroundColor: d.mood > 0 ? moodColor(d.mood) : '#f3f4f6',
                  }]} />
                  <Text style={styles.moodLabel}>{labels[i]}</Text>
                  {d.mood > 0 && <Text style={styles.moodScore}>{d.mood.toFixed(1)}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {selected && (
        <DayDetailModal
          date={selected.date}
          category={selected.category}
          visible={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  chevron: { padding: 8, width: 36, alignItems: 'center' },
  chevronText: { fontSize: 32, color: '#6366f1', lineHeight: 36 },
  chevronDisabled: { color: '#d1d5db' },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' },
  sub: { fontSize: 12, color: '#9ca3af', marginTop: 2, textAlign: 'center' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  miniStat: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  miniStatValue: { fontSize: 18, fontWeight: '800' },
  miniStatUnit: { fontSize: 9, color: '#9ca3af', fontWeight: '600' },
  miniStatLabel: { fontSize: 9, color: '#6b7280', fontWeight: '600', textAlign: 'center', marginTop: 2 },

  charts: { padding: 20, gap: 16, paddingBottom: 40 },
  chartCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  goalTag: { fontSize: 12, fontWeight: '600' },

  dayButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10, gap: 4 },
  dayBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  dayBtnLabel: { fontSize: 10, fontWeight: '700' },
  dayBtnValue: { fontSize: 11, fontWeight: '600', marginTop: 1 },

  moodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, height: 100 },
  moodCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  moodEmoji: { fontSize: 14, marginBottom: 4 },
  moodBar: { width: 24, borderRadius: 4 },
  moodLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4, fontWeight: '600' },
  moodScore: { fontSize: 9, color: '#6b7280', marginTop: 2 },
})

const modal = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  closeBtn: { paddingHorizontal: 4 },
  closeText: { fontSize: 16, color: '#6366f1', fontWeight: '600' },
  scroll: { flex: 1 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9ca3af' },

  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderLeftWidth: 4, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },

  entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 8 },
  mealIcon: { fontSize: 18, marginTop: 2 },
  entryTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  entryDetail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  entryTime: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  entryValue: { fontSize: 14, fontWeight: '700', marginLeft: 8 },

  total: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8, alignItems: 'flex-end' },
  totalText: { fontSize: 13, fontWeight: '700', color: '#374151' },
})

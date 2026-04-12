import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, PanResponder,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { getTodayEntries, getTodayStats, deleteEntry, getGoals } from '@/lib/api'
import { Entry, Goals } from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  food: '#10b981',
  exercise: '#f59e0b',
  health: '#3b82f6',
  task: '#8b5cf6',
}

const CATEGORY_ICONS: Record<string, string> = {
  food: '🍎',
  exercise: '💪',
  health: '❤️',
  task: '✅',
}

function formatEntryTitle(entry: Entry): string {
  const p = entry.parsed_data
  if (p.display_summary) return p.display_summary
  switch (entry.category) {
    case 'food':
      return p.foodName || entry.raw_text
    case 'exercise':
      return p.activityType || entry.raw_text
    case 'health':
      if (p.metricType === 'sleep') return `Sleep: ${p.value}h`
      if (p.metricType === 'mood') return `Mood: ${p.value}/10`
      if (p.metricType === 'water') return `Water: ${p.value} ${p.unit || 'oz'}`
      if (p.metricType === 'medication') return `${p.name || 'Medication'}${p.taken ? ' ✓' : ''}`
      return p.notes || entry.raw_text
    case 'task':
      return p.taskName || entry.raw_text
    default:
      return entry.raw_text
  }
}

function formatEntryDetail(entry: Entry): string {
  const p = entry.parsed_data
  const parts: string[] = []
  switch (entry.category) {
    case 'food':
      if (p.calories) parts.push(`${p.calories} cal`)
      if (p.protein) parts.push(`${p.protein}g protein`)
      if (p.quantity) parts.push(p.quantity)
      break
    case 'exercise':
      if (p.duration) parts.push(`${p.duration} ${p.durationUnit || 'min'}`)
      if (p.intensity) parts.push(p.intensity)
      if (p.caloriesBurned) parts.push(`${p.caloriesBurned} cal burned`)
      break
    case 'health':
      if (p.notes) parts.push(p.notes)
      break
    case 'task':
      if (p.taskCategory) parts.push(p.taskCategory)
      if (p.status) parts.push(p.status)
      break
  }
  return parts.join(' · ')
}

// ── Mood bar ──────────────────────────────────────────────────────────────────

const MOOD_COLORS = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#06b6d4','#3b82f6','#6366f1']
const MOOD_LABELS = ['😞','😟','😕','😐','🙂','😊','😄','😁','🤩','🥳']

function MoodBar({ entries }: { entries: Entry[] }) {
  const moodEntry = [...entries].reverse().find(e => e.category === 'health' && e.parsed_data?.metricType === 'mood')
  if (!moodEntry) return null
  const val = Math.max(1, Math.min(10, Number(moodEntry.parsed_data.value) || 0))
  const color = MOOD_COLORS[val - 1]
  const label = MOOD_LABELS[val - 1]
  return (
    <View style={styles.moodCard}>
      <Text style={styles.moodTitle}>Today's Mood</Text>
      <View style={styles.moodRow}>
        <View style={styles.moodTrack}>
          <View style={[styles.moodFill, { width: `${val * 10}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.moodEmoji}>{label}</Text>
        <Text style={[styles.moodScore, { color }]}>{val}/10</Text>
      </View>
    </View>
  )
}

// ── Stat strip ────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, icon, color, goalPct }: {
  label: string; value: number; unit: string; icon: string
  color: string; goalPct?: number
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>
        {value > 0 ? (Number.isInteger(value) ? value : value.toFixed(1)) : '—'}
      </Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {goalPct !== undefined && goalPct > 0 && (
        <View style={styles.statBar}>
          <View style={[styles.statBarFill, { width: `${Math.min(goalPct * 100, 100)}%`, backgroundColor: color }]} />
        </View>
      )}
    </View>
  )
}

// ── Entry card ────────────────────────────────────────────────────────────────

function EntryRow({ entry, onDelete }: { entry: Entry; onDelete: () => void }) {
  const color = CATEGORY_COLORS[entry.category] || '#6366f1'
  const time = new Date(entry.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const detail = formatEntryDetail(entry)

  function confirmDelete() {
    Alert.alert('Delete entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ])
  }

  return (
    <View style={styles.entryRow}>
      <View style={[styles.entryDot, { backgroundColor: color }]} />
      <View style={styles.entryContent}>
        <Text style={styles.entryTitle}>{CATEGORY_ICONS[entry.category]} {formatEntryTitle(entry)}</Text>
        {detail ? <Text style={styles.entryDetail}>{detail}</Text> : null}
        <Text style={styles.entryTime}>{time}</Text>
      </View>
      <TouchableOpacity onPress={confirmDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="trash-outline" size={18} color="#d1d5db" />
      </TouchableOpacity>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [stats, setStats] = useState({ calories: 0, water_oz: 0, exercise_minutes: 0, sleep_hours: 0, workouts: 0 })
  const [goals, setGoals] = useState<Goals | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userName, setUserName] = useState('')
  const [dayOffset, setDayOffset] = useState(0)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  function targetDate(offset: number) {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    const tz = d.getTimezoneOffset()
    return new Date(d.getTime() - tz * 60000).toISOString().split('T')[0]
  }

  async function load(offset = 0) {
    const date = targetDate(offset)
    try {
      const [e, s, g] = await Promise.all([getTodayEntries(date), getTodayStats(date), getGoals()])
      setEntries(e)
      setStats(s)
      setGoals(g)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function goBack() { setDayOffset(o => o + 1) }
  function goForward() { if (dayOffset > 0) setDayOffset(o => o - 1) }

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -40) goBack()
      else if (gs.dx > 40) goForward()
    },
  })).current

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserName(user.email.split('@')[0])
    })
  }, [])

  useFocusEffect(useCallback(() => { load(dayOffset) }, [dayOffset]))

  async function handleDelete(id: string) {
    await deleteEntry(id)
    await load(dayOffset)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  async function handleChangePassword() {
    setPasswordError('')
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    setPasswordLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordLoading(false)
    if (error) {
      setPasswordError(error.message)
    } else {
      setShowPasswordModal(false)
      setNewPassword('')
      setConfirmPassword('')
      Alert.alert('Password updated', 'Your password has been changed successfully.')
    }
  }

  const displayDate = new Date()
  displayDate.setDate(displayDate.getDate() - dayOffset)
  const tz = displayDate.getTimezoneOffset()
  const localDisplay = new Date(displayDate.getTime() - tz * 60000)
  const today = localDisplay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#6366f1" />}
      >
        {/* Header */}
        <View style={styles.header} {...panResponder.panHandlers}>
          <View style={styles.headerNav}>
            <TouchableOpacity onPress={goBack} style={styles.chevron}>
              <Text style={styles.chevronText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.greeting}>
                {dayOffset === 0 ? `Good ${greeting()}, ${userName} 👋` : userName}
              </Text>
              <Text style={styles.date}>{today}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={goForward} style={styles.chevron} disabled={dayOffset === 0}>
                <Text style={[styles.chevronText, dayOffset === 0 && styles.chevronDisabled]}>›</Text>
              </TouchableOpacity>
              {dayOffset === 0 && (
                <View style={styles.headerActions}>
                  <TouchableOpacity onPress={() => setShowPasswordModal(true)} style={styles.signOutBtn}>
                    <Ionicons name="key-outline" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
                    <Ionicons name="log-out-outline" size={22} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stat strip */}
        <View style={styles.statsRow}>
          <StatCard
            label="Calories" value={stats.calories} unit="kcal" icon="🔥" color="#ef4444"
            goalPct={goals ? stats.calories / goals.daily_calories : undefined}
          />
          <StatCard
            label="Water" value={stats.water_oz} unit="oz" icon="💧" color="#3b82f6"
            goalPct={goals ? stats.water_oz / goals.daily_water_oz : undefined}
          />
          <StatCard
            label="Workouts" value={stats.workouts} unit="sessions" icon="💪" color="#f59e0b"
          />
          <StatCard
            label="Sleep" value={stats.sleep_hours} unit="hrs" icon="😴" color="#8b5cf6"
            goalPct={goals ? stats.sleep_hours / goals.sleep_hours : undefined}
          />
        </View>

        {/* Mood bar */}
        <MoodBar entries={entries} />

        {/* Today's entries */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Log</Text>
          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎙️</Text>
              <Text style={styles.emptyText}>No entries yet. Tap Log to add your first one!</Text>
            </View>
          ) : (
            <View style={styles.entriesList}>
              {entries.map(entry => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onDelete={() => handleDelete(entry.id)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <TouchableOpacity
              style={[styles.modalBtn, passwordLoading && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={passwordLoading}
            >
              {passwordLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalBtnText}>Update Password</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowPasswordModal(false); setNewPassword(''); setConfirmPassword(''); setPasswordError('') }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  header: { paddingTop: 12, paddingBottom: 8 },
  headerNav: { flexDirection: 'row', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', width: 72, justifyContent: 'flex-end' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  chevron: { padding: 8, width: 36, alignItems: 'center' },
  chevronText: { fontSize: 32, color: '#6366f1', lineHeight: 36 },
  chevronDisabled: { color: '#d1d5db' },
  greeting: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  date: { fontSize: 13, color: '#6b7280', marginTop: 2, textAlign: 'center' },
  signOutBtn: { padding: 6 },

  statsRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 10, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statUnit: { fontSize: 9, color: '#9ca3af', fontWeight: '600', marginBottom: 2 },
  statLabel: { fontSize: 10, color: '#6b7280', fontWeight: '600' },
  statBar: {
    width: '100%', height: 3, backgroundColor: '#f3f4f6', borderRadius: 2, marginTop: 6,
  },
  statBarFill: { height: 3, borderRadius: 2 },

  moodCard: {
    marginHorizontal: 20, marginBottom: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  moodTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moodTrack: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  moodFill: { height: 8, borderRadius: 4 },
  moodEmoji: { fontSize: 20 },
  moodScore: { fontSize: 14, fontWeight: '700', minWidth: 32, textAlign: 'right' },

  section: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9ca3af', textAlign: 'center' },

  entriesList: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    overflow: 'hidden',
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  entryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  entryContent: { flex: 1 },
  entryTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  entryDetail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  entryTime: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 48,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14,
    fontSize: 16, color: '#111827', marginBottom: 12, backgroundColor: '#f9fafb',
  },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  modalBtn: {
    backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12,
  },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelText: { color: '#6b7280', fontSize: 15, textAlign: 'center', paddingVertical: 4 },
})

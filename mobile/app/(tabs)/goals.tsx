import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getGoals, upsertGoals, getTodayStats } from '@/lib/api'
import { Goals } from '@/lib/types'

interface GoalRowProps {
  icon: string
  label: string
  value: string
  unit: string
  onChangeText: (v: string) => void
  current: number
  color: string
}

function GoalRow({ icon, label, value, unit, onChangeText, current, color }: GoalRowProps) {
  const target = parseFloat(value) || 0
  const pct = target > 0 ? Math.min(current / target, 1) : 0

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalIcon}>{icon}</Text>
        <View style={styles.goalInfo}>
          <Text style={styles.goalLabel}>{label}</Text>
          <Text style={styles.goalProgress}>
            {current > 0 ? `${current} / ` : ''}{value || '—'} {unit}
          </Text>
        </View>
        <TextInput
          style={styles.goalInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.progressLabel}>
        {pct >= 1 ? '✅ Goal reached!' : `${Math.round(pct * 100)}% of daily goal`}
      </Text>
    </View>
  )
}

export default function GoalsScreen() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ calories: 0, water_oz: 0, exercise_minutes: 0, sleep_hours: 0, workouts: 0 })

  // Goal fields as strings for easy editing
  const [calories, setCalories] = useState('1800')
  const [water, setWater] = useState('64')
  const [sleep, setSleep] = useState('7.5')
  const [exerciseDays, setExerciseDays] = useState('4')

  async function load() {
    try {
      const [g, s] = await Promise.all([getGoals(), getTodayStats()])
      if (g) {
        setCalories(String(g.daily_calories))
        setWater(String(g.daily_water_oz))
        setSleep(String(g.sleep_hours))
        setExerciseDays(String(g.exercise_days_week))
      }
      setStats(s)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  async function handleSave() {
    setSaving(true)
    try {
      await upsertGoals({
        daily_calories: parseInt(calories) || 1800,
        daily_water_oz: parseInt(water) || 64,
        sleep_hours: parseFloat(sleep) || 7.5,
        exercise_days_week: parseInt(exerciseDays) || 4,
      })
      Alert.alert('Saved!', 'Your goals have been updated.')
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Daily Goals</Text>
          <Text style={styles.sub}>Edit your targets and track today's progress</Text>
        </View>

        <View style={styles.goals}>
          <GoalRow
            icon="🔥" label="Calories" value={calories} unit="kcal"
            onChangeText={setCalories} current={stats.calories} color="#ef4444"
          />
          <GoalRow
            icon="💧" label="Water" value={water} unit="oz"
            onChangeText={setWater} current={stats.water_oz} color="#3b82f6"
          />
          <GoalRow
            icon="😴" label="Sleep" value={sleep} unit="hrs"
            onChangeText={setSleep} current={stats.sleep_hours} color="#8b5cf6"
          />
          <GoalRow
            icon="💪" label="Workout days/week" value={exerciseDays} unit="days"
            onChangeText={setExerciseDays} current={stats.workouts} color="#f59e0b"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Goals</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 15, color: '#6b7280', marginTop: 4 },

  goals: { padding: 20, gap: 12 },

  goalCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  goalIcon: { fontSize: 28, marginRight: 12 },
  goalInfo: { flex: 1 },
  goalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  goalProgress: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  goalInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 18, fontWeight: '700', color: '#6366f1',
    width: 80, textAlign: 'center',
  },

  progressTrack: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12, color: '#9ca3af', marginTop: 6, fontWeight: '500' },

  saveBtn: {
    backgroundColor: '#6366f1', margin: 20, marginTop: 4,
    borderRadius: 14, padding: 18, alignItems: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})

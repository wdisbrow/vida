import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getAllTasks, deleteEntry, updateTaskStatus } from '@/lib/api'
import { Entry } from '@/lib/types'

const STATUS_COLOR: Record<string, string> = {
  pending:       '#f59e0b',
  'in-progress': '#3b82f6',
  completed:     '#10b981',
  done:          '#10b981',
}

const STATUS_ICON: Record<string, string> = {
  pending:       '○',
  'in-progress': '◑',
  completed:     '●',
  done:          '●',
}

const STATUS_CYCLE: Record<string, string> = {
  pending:       'in-progress',
  'in-progress': 'completed',
  completed:     'pending',
  done:          'pending',
}

function statusColor(s?: string) {
  if (!s) return '#9ca3af'
  return STATUS_COLOR[s.toLowerCase()] ?? '#6366f1'
}

function statusIcon(s?: string) {
  if (!s) return '○'
  return STATUS_ICON[s.toLowerCase()] ?? '○'
}

function nextStatus(current?: string): string {
  if (!current) return 'in-progress'
  return STATUS_CYCLE[current.toLowerCase()] ?? 'in-progress'
}

function isToday(dateStr: string): boolean {
  const now = new Date()
  const d = new Date(dateStr)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function formatTaskTime(dateStr: string): string {
  const d = new Date(dateStr)
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday(dateStr)) return timeStr
  const dateLabel = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return `${dateLabel} · ${timeStr}`
}

function TaskRow({
  entry,
  onDelete,
  onStatusChange,
  showOverdueBadge,
}: {
  entry: Entry
  onDelete: () => void
  onStatusChange: (newStatus: string) => void
  showOverdueBadge?: boolean
}) {
  const p = entry.parsed_data
  const name      = p.display_summary || p.taskName || entry.raw_text
  const status    = p.status ?? 'pending'
  const category  = p.taskCategory ?? ''
  const timeLabel = formatTaskTime(entry.occurred_at)
  const color     = statusColor(status)
  const overdue   = showOverdueBadge && !isToday(entry.occurred_at)

  function confirmDelete() {
    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ])
  }

  return (
    <View style={styles.taskRow}>
      {/* Tappable left section: status icon + task info */}
      <TouchableOpacity
        style={styles.taskRowLeft}
        activeOpacity={0.5}
        onPress={() => onStatusChange(nextStatus(status))}
      >
        <View style={styles.statusIconWrap}>
          <Text style={[styles.statusIcon, { color }]}>{statusIcon(status)}</Text>
        </View>
        <View style={styles.taskContent}>
          <Text style={styles.taskName}>{name}</Text>
          <View style={styles.taskMeta}>
            {overdue && (
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueText}>overdue</Text>
              </View>
            )}
            {category ? (
              <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.badgeText, { color }]}>{category}</Text>
              </View>
            ) : null}
            <Text style={styles.taskTime}>{timeLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Delete button — separate from left section so touches don't conflict */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={confirmDelete}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="trash-outline" size={18} color="#d1d5db" />
      </TouchableOpacity>
    </View>
  )
}

export default function TasksScreen() {
  const [tasks, setTasks]           = useState<Entry[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const all = await getAllTasks()
      setTasks(all)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  async function handleDelete(id: string) {
    await deleteEntry(id)
    await load()
  }

  async function handleStatusChange(entry: Entry, newStatus: string) {
    // Optimistic update — instant feedback
    setTasks(prev =>
      prev.map(t =>
        t.id === entry.id
          ? { ...t, parsed_data: { ...t.parsed_data, status: newStatus } }
          : t
      )
    )
    try {
      await updateTaskStatus(entry, newStatus)
    } catch (err) {
      console.error('Status update failed:', err)
      await load() // revert on error
    }
  }

  const pending = tasks.filter(
    t => !['completed', 'done'].includes((t.parsed_data.status ?? '').toLowerCase())
  )

  // Show all completed tasks (not just today's — old tasks can be marked done too)
  const completed = tasks.filter(
    t => ['completed', 'done'].includes((t.parsed_data.status ?? '').toLowerCase())
  )

  const overdueCount = pending.filter(t => !isToday(t.occurred_at)).length

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
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor="#6366f1"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tasks</Text>
          <Text style={styles.subtitle}>
            {pending.length} pending
            {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
            {completed.length > 0 ? ` · ${completed.length} done` : ''}
          </Text>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No tasks yet. Tap Log to add one!</Text>
          </View>
        ) : (
          <>
            {pending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PENDING</Text>
                <View style={styles.list}>
                  {pending.map(t => (
                    <TaskRow
                      key={t.id}
                      entry={t}
                      onDelete={() => handleDelete(t.id)}
                      onStatusChange={(newStatus) => handleStatusChange(t, newStatus)}
                      showOverdueBadge
                    />
                  ))}
                </View>
              </View>
            )}

            {completed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>COMPLETED</Text>
                <View style={styles.list}>
                  {completed.map(t => (
                    <TaskRow
                      key={t.id}
                      entry={t}
                      onDelete={() => handleDelete(t.id)}
                      onStatusChange={(newStatus) => handleStatusChange(t, newStatus)}
                    />
                  ))}
                </View>
              </View>
            )}

            {pending.length === 0 && completed.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyText}>All caught up!</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  header:   { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title:    { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#9ca3af', marginTop: 2 },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  list: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, overflow: 'hidden',
  },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  taskRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 8,
  },
  statusIconWrap: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  statusIcon:  { fontSize: 22 },
  taskContent: { flex: 1 },
  taskName:    { fontSize: 14, fontWeight: '600', color: '#111827' },
  taskMeta:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },

  badge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  overdueBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#fee2e2' },
  overdueText:  { fontSize: 11, fontWeight: '600', color: '#ef4444' },

  taskTime: { fontSize: 11, color: '#9ca3af' },

  deleteBtn: { paddingHorizontal: 14 },

  empty:     { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9ca3af', textAlign: 'center' },
})

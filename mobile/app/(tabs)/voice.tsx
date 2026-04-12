import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, TextInput, Animated,
} from 'react-native'
import { Audio } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { transcribeAudio, parseTranscript, saveEntry } from '@/lib/api'
import { ParsedData } from '@/lib/types'

type Step = 'idle' | 'recording' | 'transcribing' | 'clarifying' | 'parsed' | 'saving' | 'saved'

const CATEGORY_COLORS: Record<string, string> = {
  food: '#10b981',
  exercise: '#f59e0b',
  health: '#3b82f6',
  task: '#8b5cf6',
}

const CATEGORY_LABELS: Record<string, string> = {
  food: '🍎 Food',
  exercise: '💪 Exercise',
  health: '❤️ Health',
  task: '✅ Task',
}

function ConfirmField({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{String(value)}</Text>
    </View>
  )
}

function ParsedCard({ category, parsed }: { category: string; parsed: ParsedData }) {
  const color = CATEGORY_COLORS[category] || '#6366f1'
  return (
    <View style={[styles.parsedCard, { borderLeftColor: color }]}>
      <Text style={[styles.categoryBadge, { backgroundColor: color + '20', color }]}>
        {CATEGORY_LABELS[category] || category}
      </Text>

      {/* Food */}
      {category === 'food' && (
        <>
          <ConfirmField label="Food" value={parsed.foodName} />
          <ConfirmField label="Quantity" value={parsed.quantity} />
          <ConfirmField label="Meal type" value={parsed.mealType} />
          <ConfirmField label="Calories" value={parsed.calories ? `${parsed.calories} kcal` : undefined} />
          <ConfirmField label="Protein" value={parsed.protein ? `${parsed.protein}g` : undefined} />
          <ConfirmField label="Carbs" value={parsed.carbs ? `${parsed.carbs}g` : undefined} />
          <ConfirmField label="Fat" value={parsed.fat ? `${parsed.fat}g` : undefined} />
        </>
      )}

      {/* Exercise */}
      {category === 'exercise' && (
        <>
          <ConfirmField label="Activity" value={parsed.activityType} />
          <ConfirmField label="Duration" value={parsed.duration ? `${parsed.duration} ${parsed.durationUnit || 'min'}` : undefined} />
          <ConfirmField label="Intensity" value={parsed.intensity} />
          <ConfirmField label="Calories burned" value={parsed.caloriesBurned ? `${parsed.caloriesBurned} kcal` : undefined} />
        </>
      )}

      {/* Health */}
      {category === 'health' && (
        <>
          <ConfirmField label="Type" value={parsed.metricType} />
          <ConfirmField label="Value" value={parsed.value ? `${parsed.value} ${parsed.unit || ''}` : undefined} />
          <ConfirmField label="Notes" value={parsed.notes} />
          {parsed.metricType === 'medication' && (
            <ConfirmField label="Taken" value={parsed.taken ? 'Yes' : 'No'} />
          )}
        </>
      )}

      {/* Task */}
      {category === 'task' && (
        <>
          <ConfirmField label="Task" value={parsed.taskName} />
          <ConfirmField label="Category" value={parsed.taskCategory} />
          <ConfirmField label="Status" value={parsed.status} />
        </>
      )}
    </View>
  )
}

export default function VoiceScreen() {
  const [step, setStep] = useState<Step>('idle')
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [transcript, setTranscript] = useState('')
  const [category, setCategory] = useState('')
  const [parsedData, setParsedData] = useState<ParsedData>({})
  const [occurredAt, setOccurredAt] = useState<string | undefined>(undefined)
  const [confidence, setConfidence] = useState<number>(1.0)
  const [editTranscript, setEditTranscript] = useState('')
  const [clarificationPrompt, setClarificationPrompt] = useState('')
  const [clarificationOptions, setClarificationOptions] = useState<string[] | null>(null)
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [textInput, setTextInput] = useState('')
  const pulseAnim = useRef(new Animated.Value(1)).current

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start()
  }

  function stopPulse() {
    pulseAnim.stopAnimation()
    pulseAnim.setValue(1)
  }

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync()
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow microphone access in Settings to record voice entries.')
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      setRecording(recording)
      setStep('recording')
      startPulse()
    } catch (err) {
      Alert.alert('Error', 'Could not start recording. Please try again.')
      console.error(err)
    }
  }

  async function stopRecording() {
    if (!recording) return
    stopPulse()
    setStep('transcribing')

    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecording(null)

      if (!uri) throw new Error('No audio file')

      // Transcribe
      const text = await transcribeAudio(uri)
      setTranscript(text)
      setEditTranscript(text)

      // Parse
      const result = await parseTranscript(text)
      setCategory(result.category)
      setParsedData(result.parsed_data)
      setOccurredAt(result.occurred_at)
      setConfidence(result.confidence)

      if (result.needs_clarification && result.clarification_prompt) {
        setClarificationPrompt(result.clarification_prompt)
        setClarificationOptions(result.clarification_options ?? null)
        setClarificationAnswer('')
        setStep('clarifying')
      } else {
        setStep('parsed')
      }
    } catch (err: any) {
      console.error(err)
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.')
      reset()
    }
  }

  async function handleSave() {
    setStep('saving')
    try {
      await saveEntry(category, transcript, parsedData, occurredAt, confidence)
      setStep('saved')
      setTimeout(() => reset(), 1800)
    } catch (err: any) {
      Alert.alert('Save failed', err.message)
      setStep('parsed')
    }
  }

  async function handleClarify(answer: string) {
    const finalAnswer = answer || clarificationAnswer
    if (!finalAnswer.trim()) return
    setStep('transcribing')
    try {
      const combined = `${transcript} [Follow-up answer: ${finalAnswer}]`
      const result = await parseTranscript(combined)
      setCategory(result.category)
      setParsedData(result.parsed_data)
      setOccurredAt(result.occurred_at)
      setConfidence(result.confidence)
      // If still needs clarification, loop; otherwise proceed
      if (result.needs_clarification && result.clarification_prompt) {
        setClarificationPrompt(result.clarification_prompt)
        setClarificationOptions(result.clarification_options ?? null)
        setClarificationAnswer('')
        setStep('clarifying')
      } else {
        setStep('parsed')
      }
    } catch (err: any) {
      Alert.alert('Error', err.message)
      setStep('parsed')
    }
  }

  async function handleTextSubmit() {
    const text = textInput.trim()
    if (!text) return
    setTextInput('')
    setStep('transcribing')
    try {
      const result = await parseTranscript(text)
      setTranscript(text)
      setEditTranscript(text)
      setCategory(result.category)
      setParsedData(result.parsed_data)
      setOccurredAt(result.occurred_at)
      setConfidence(result.confidence)
      if (result.needs_clarification && result.clarification_prompt) {
        setClarificationPrompt(result.clarification_prompt)
        setClarificationOptions(result.clarification_options ?? null)
        setClarificationAnswer('')
        setStep('clarifying')
      } else {
        setStep('parsed')
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not parse entry.')
      setStep('idle')
    }
  }

  async function handleRetry() {
    // Re-parse with edited transcript
    setStep('transcribing')
    try {
      const result = await parseTranscript(editTranscript)
      setTranscript(editTranscript)
      setCategory(result.category)
      setParsedData(result.parsed_data)
      setStep('parsed')
    } catch (err: any) {
      Alert.alert('Error', err.message)
      setStep('parsed')
    }
  }

  function reset() {
    setStep('idle')
    setRecording(null)
    setTranscript('')
    setEditTranscript('')
    setCategory('')
    setParsedData({})
    setClarificationPrompt('')
    setClarificationOptions(null)
    setClarificationAnswer('')
    setTextInput('')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Log Entry</Text>
        <Text style={styles.screenSub}>Tap the mic and speak naturally</Text>

        {/* ── IDLE / RECORDING ── */}
        {(step === 'idle' || step === 'recording') && (
          <View style={styles.micSection}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <LinearGradient
                colors={step === 'recording' ? ['#ef4444', '#dc2626'] : ['#6366f1', '#8b5cf6']}
                style={styles.micButton}
              >
                <TouchableOpacity
                  onPress={step === 'idle' ? startRecording : stopRecording}
                  style={styles.micTouchable}
                >
                  <Ionicons
                    name={step === 'recording' ? 'stop' : 'mic'}
                    size={48}
                    color="#fff"
                  />
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>
            <Text style={styles.micHint}>
              {step === 'idle' ? 'Tap to start recording' : 'Tap to stop'}
            </Text>
            {step === 'recording' && (
              <View style={styles.recordingIndicator}>
                <View style={styles.redDot} />
                <Text style={styles.recordingText}>Recording...</Text>
              </View>
            )}

            {/* Keyboard entry bar */}
            {step === 'idle' && (
              <View style={styles.textBar}>
                <TextInput
                  style={styles.textBarInput}
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder="Or type your entry here..."
                  placeholderTextColor="#9ca3af"
                  returnKeyType="send"
                  onSubmitEditing={handleTextSubmit}
                  blurOnSubmit={false}
                  multiline={false}
                />
                <TouchableOpacity
                  onPress={handleTextSubmit}
                  style={[styles.textBarBtn, !textInput.trim() && styles.textBarBtnDisabled]}
                  disabled={!textInput.trim()}
                >
                  <Ionicons name="arrow-up" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Example prompts */}
            {step === 'idle' && (
              <View style={styles.examples}>
                <Text style={styles.examplesTitle}>Try saying:</Text>
                {[
                  '"I had oatmeal with blueberries for breakfast"',
                  '"Did a 30 minute run at moderate pace"',
                  '"Slept 7.5 hours, feeling well rested"',
                  '"Took my vitamins and drank 16 oz of water"',
                ].map((ex, i) => (
                  <Text key={i} style={styles.exampleText}>{ex}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── TRANSCRIBING ── */}
        {step === 'transcribing' && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Transcribing & parsing...</Text>
          </View>
        )}

        {/* ── CLARIFYING ── */}
        {step === 'clarifying' && (
          <View style={styles.clarifySection}>
            <Text style={styles.clarifyTitle}>One quick question</Text>
            <View style={styles.clarifyCard}>
              <Text style={styles.clarifyPrompt}>{clarificationPrompt}</Text>

              {/* Chip options */}
              {clarificationOptions && clarificationOptions.length > 0 ? (
                <View style={styles.chipsRow}>
                  {clarificationOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, clarificationAnswer === opt && styles.chipSelected]}
                      onPress={() => handleClarify(opt)}
                    >
                      <Text style={[styles.chipText, clarificationAnswer === opt && styles.chipTextSelected]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                /* Open-ended text input */
                <View style={styles.clarifyInputBox}>
                  <TextInput
                    style={styles.clarifyInput}
                    value={clarificationAnswer}
                    onChangeText={setClarificationAnswer}
                    placeholder="Type your answer..."
                    placeholderTextColor="#9ca3af"
                    returnKeyType="done"
                    onSubmitEditing={() => handleClarify(clarificationAnswer)}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.clarifySubmit, !clarificationAnswer.trim() && styles.clarifySubmitDisabled]}
                    onPress={() => handleClarify(clarificationAnswer)}
                    disabled={!clarificationAnswer.trim()}
                  >
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity onPress={() => setStep('parsed')} style={styles.skipBtn}>
              <Text style={styles.skipBtnText}>Skip — save as is</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PARSED (confirm card) ── */}
        {step === 'parsed' && (
          <View style={styles.confirmSection}>
            <Text style={styles.confirmTitle}>Does this look right?</Text>

            {/* Editable transcript */}
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>You said:</Text>
              <TextInput
                style={styles.transcriptInput}
                value={editTranscript}
                onChangeText={setEditTranscript}
                multiline
                numberOfLines={3}
              />
              {editTranscript !== transcript && (
                <TouchableOpacity onPress={handleRetry} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Re-parse</Text>
                </TouchableOpacity>
              )}
            </View>

            <ParsedCard category={category} parsed={parsedData} />

            {/* Actions */}
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.discardBtn} onPress={reset}>
                <Text style={styles.discardBtnText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Entry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── SAVING ── */}
        {step === 'saving' && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Saving...</Text>
          </View>
        )}

        {/* ── SAVED ── */}
        {step === 'saved' && (
          <View style={styles.savedSection}>
            <Text style={styles.savedIcon}>✅</Text>
            <Text style={styles.savedText}>Entry saved!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, paddingBottom: 40 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 4 },
  screenSub: { fontSize: 15, color: '#6b7280', marginBottom: 32 },

  micSection: { alignItems: 'center' },
  micButton: {
    width: 120, height: 120, borderRadius: 60,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 12,
  },
  micTouchable: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  micHint: { fontSize: 16, color: '#6b7280', marginTop: 20, fontWeight: '500' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  recordingText: { fontSize: 15, color: '#ef4444', fontWeight: '600' },

  textBar: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    marginTop: 28, gap: 10,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb',
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  textBarInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 8 },
  textBarBtn: {
    backgroundColor: '#6366f1', borderRadius: 10, padding: 10,
  },
  textBarBtnDisabled: { backgroundColor: '#c7d2fe' },

  examples: {
    marginTop: 40, alignSelf: 'stretch',
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  examplesTitle: { fontSize: 13, fontWeight: '700', color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleText: { fontSize: 14, color: '#374151', marginBottom: 8, fontStyle: 'italic' },

  loadingSection: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { fontSize: 16, color: '#6b7280' },

  clarifySection: { gap: 16 },
  clarifyTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  clarifyCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, gap: 16,
  },
  clarifyPrompt: { fontSize: 16, color: '#374151', lineHeight: 24, fontWeight: '500' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24,
    borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  chipSelected: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chipTextSelected: { color: '#fff' },
  clarifyInputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb',
    paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  clarifyInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 8 },
  clarifySubmit: {
    backgroundColor: '#6366f1', borderRadius: 8, padding: 10,
  },
  clarifySubmitDisabled: { backgroundColor: '#c7d2fe' },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipBtnText: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },

  confirmSection: { gap: 16 },
  confirmTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  transcriptBox: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  transcriptLabel: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 },
  transcriptInput: { fontSize: 15, color: '#374151', lineHeight: 22 },
  retryBtn: {
    marginTop: 10, backgroundColor: '#ede9fe', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  retryBtnText: { color: '#6366f1', fontWeight: '700', fontSize: 13 },

  parsedCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    gap: 10,
  },
  categoryBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, fontSize: 13, fontWeight: '700', marginBottom: 6,
  },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  fieldValue: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'right' },

  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  discardBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  discardBtnText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  saveBtn: {
    flex: 2, backgroundColor: '#6366f1',
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  savedSection: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  savedIcon: { fontSize: 64 },
  savedText: { fontSize: 22, fontWeight: '700', color: '#10b981' },
})

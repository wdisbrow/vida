'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useVoice } from '@/hooks/useVoice';
import { useEntries } from '@/hooks/useEntries';
import VoiceButton from '@/components/VoiceButton';
import ConfirmCard from '@/components/ConfirmCard';
import DailyLog from '@/components/DailyLog';
import { ParseResult, FoodData, HealthData } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function TodayPage() {
  const router = useRouter();
  const [userId, setUserId]             = useState<string | undefined>(undefined);
  const [weightLbs, setWeightLbs]       = useState<number>(140);
  const [parseResult, setParseResult]   = useState<ParseResult | null>(null);
  const [saving, setSaving]             = useState<boolean>(false);
  const [savedFlash, setSavedFlash]     = useState<boolean>(false);

  const { state, setState, transcript, startListening, stopListening, reset, isSupported, micError } = useVoice();
  const { entries, loading } = useEntries(userId);

  // Auth check + fetch user profile (for real weight)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login');
      } else {
        setUserId(data.user.id);
        // Fetch real weight from profiles table
        supabase
          .from('profiles')
          .select('weight_lbs')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.weight_lbs) setWeightLbs(profile.weight_lbs);
          });
      }
    });
  }, [router]);

  // When voice capture finishes (state = 'processing'), call the parse API
  useEffect(() => {
    if (state !== 'processing' || !transcript.trim()) return;

    (async () => {
      try {
        const res = await fetch('/api/parse-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            datetime: new Date().toISOString(),
            weightLbs,           // ← real user weight now
          }),
        });

        if (!res.ok) throw new Error('Parse failed');
        const result: ParseResult = await res.json();
        setParseResult(result);
        setState('idle');
      } catch (err) {
        console.error(err);
        setState('error');
      }
    })();
  }, [state, transcript, setState, weightLbs]);

  // Save confirmed entry to Supabase
  const handleSave = async () => {
    if (!parseResult || !userId) return;
    setSaving(true);
    try {
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:     userId,
          occurred_at: parseResult.occurred_at,
          category:    parseResult.category,
          raw_text:    transcript,
          parsed_data: parseResult.parsed_data,
          confidence:  parseResult.confidence,
          source:      'voice',
        }),
      });

      setParseResult(null);
      reset();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setParseResult(null);
    reset();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/entries?id=${id}`, { method: 'DELETE' });
  };

  // ── Stat strip calculations ─────────────────────────────────────────────────
  const totalCalories = entries
    .filter((e) => e.category === 'food')
    .reduce((sum, e) => sum + ((e.parsed_data as FoodData).calories ?? 0), 0);

  const totalWaterOz = entries
    .filter(
      (e) =>
        e.category === 'health' &&
        (e.parsed_data as HealthData).metricType === 'water'
    )
    .reduce((sum, e) => sum + ((e.parsed_data as HealthData).value ?? 0), 0);

  const lastSleepEntry = entries.find(
    (e) =>
      e.category === 'health' &&
      (e.parsed_data as HealthData).metricType === 'sleep'
  );
  const sleepHrs = lastSleepEntry
    ? ((lastSleepEntry.parsed_data as HealthData).value ?? 0)
    : null;

  const exerciseCount = entries.filter((e) => e.category === 'exercise').length;

  const showStats = entries.length > 0;

  return (
    <div className="px-4 pt-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-blue-900">Vida</h1>
        <p className="text-gray-500 text-lg" suppressHydrationWarning>{formatDate(new Date())}</p>
      </div>

      {/* Quick stats strip */}
      {showStats && (
        <div className="grid grid-cols-4 gap-2">
          <StatPill emoji="🍽️" value={`${totalCalories}`} label="cal" />
          <StatPill emoji="💧" value={totalWaterOz > 0 ? `${totalWaterOz} oz` : '—'} label="water" />
          <StatPill emoji="💪" value={`${exerciseCount}`} label={exerciseCount === 1 ? 'workout' : 'workouts'} />
          <StatPill
            emoji="😴"
            value={sleepHrs !== null ? `${sleepHrs}h` : '—'}
            label="sleep"
          />
        </div>
      )}

      {/* Saved flash */}
      {savedFlash && (
        <div className="text-center py-2 bg-green-100 text-green-700 rounded-xl font-medium animate-pulse">
          ✓ Saved!
        </div>
      )}

      {/* Voice button or confirm card */}
      <div className="flex flex-col items-center py-4">
        {parseResult ? (
          <ConfirmCard
            result={parseResult}
            onSave={handleSave}
            onDiscard={handleDiscard}
            saving={saving}
          />
        ) : (
          <>
            {!isSupported && (
              <p className="text-amber-600 text-sm text-center mb-4">
                Voice input requires Chrome or Safari. Please open this app in Chrome.
              </p>
            )}
            {micError && (
              <p className="text-red-500 text-sm text-center mb-4">{micError}</p>
            )}
            <VoiceButton
              state={state}
              transcript={transcript}
              onPress={
                state === 'listening'                     ? stopListening  :
                (state === 'idle' || state === 'error')   ? startListening :
                () => {}
              }
            />
          </>
        )}
      </div>

      {/* Daily log */}
      <DailyLog entries={entries} loading={loading} onDelete={handleDelete} />
    </div>
  );
}

function StatPill({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="bg-white rounded-xl px-2 py-2 shadow-sm border border-gray-100 text-center">
      <p className="text-lg leading-none">{emoji}</p>
      <p className="text-blue-800 font-bold text-xs mt-1 truncate">{value}</p>
      <p className="text-gray-400 text-xs">{label}</p>
    </div>
  );
}

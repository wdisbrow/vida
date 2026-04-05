'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Common timezones — enough to cover the likely user base
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const TZ_LABELS: Record<string, string> = {
  'America/New_York':   'Eastern (ET)',
  'America/Chicago':    'Central (CT)',
  'America/Denver':     'Mountain (MT)',
  'America/Phoenix':    'Arizona (no DST)',
  'America/Los_Angeles':'Pacific (PT)',
  'America/Anchorage':  'Alaska (AKT)',
  'Pacific/Honolulu':   'Hawaii (HT)',
  'Europe/London':      'London (GMT/BST)',
  'Europe/Paris':       'Paris (CET)',
  'Europe/Berlin':      'Berlin (CET)',
  'Asia/Tokyo':         'Tokyo (JST)',
  'Asia/Shanghai':      'Shanghai (CST)',
  'Australia/Sydney':   'Sydney (AEST)',
};

interface Profile {
  full_name: string;
  weight_lbs: number;
  height_in: number;
  timezone: string;
}

const DEFAULT_PROFILE: Profile = {
  full_name:  '',
  weight_lbs: 140,
  height_in:  65, // 5'5" default
  timezone:   'America/New_York',
};

// Convert total inches to feet + inches display
function inchesToDisplay(total: number): string {
  const ft = Math.floor(total / 12);
  const inches = Math.round(total % 12);
  return `${ft}' ${inches}"`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId]     = useState<string | null>(null);
  const [email, setEmail]       = useState<string>('');
  const [profile, setProfile]   = useState<Profile>(DEFAULT_PROFILE);
  const [draft, setDraft]       = useState<Profile>(DEFAULT_PROFILE);
  const [editing, setEditing]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Auth + load profile
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setUserId(user.id);
      setEmail(user.email ?? '');

      const { data } = await supabase
        .from('profiles')
        .select('full_name, weight_lbs, height_in, timezone')
        .eq('id', user.id)
        .single();

      if (data) {
        const p: Profile = {
          full_name:  data.full_name  ?? '',
          weight_lbs: data.weight_lbs ?? 140,
          height_in:  data.height_in  ?? 65,
          timezone:   data.timezone   ?? 'America/New_York',
        };
        setProfile(p);
        setDraft(p);
      }
      setLoading(false);
    })();
  }, [router]);

  const startEdit = () => {
    setDraft({ ...profile });
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft({ ...profile });
    setEditing(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name:  draft.full_name.trim() || null,
        weight_lbs: draft.weight_lbs,
        height_in:  draft.height_in,
        timezone:   draft.timezone,
      })
      .eq('id', userId);

    setSaving(false);
    if (!error) {
      setProfile({ ...draft });
      setEditing(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const active = editing ? draft : profile;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Profile</h1>
          <p className="text-gray-500 text-lg">Your info &amp; settings</p>
        </div>
        {!editing ? (
          <button
            onClick={startEdit}
            className="px-4 py-2 text-blue-600 border border-blue-200 rounded-xl font-medium hover:bg-blue-50 transition-colors"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={cancelEdit}
              className="px-3 py-2 text-gray-500 rounded-xl font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save ✓'}
            </button>
          </div>
        )}
      </div>

      {/* Saved flash */}
      {savedFlash && (
        <div className="text-center py-2 bg-green-100 text-green-700 rounded-xl font-medium">
          ✓ Profile saved!
        </div>
      )}

      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">

        {/* Name */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-2xl w-8 text-center">👤</span>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Name</p>
            {editing ? (
              <input
                type="text"
                value={draft.full_name}
                placeholder="Your name"
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                className="w-full border-2 border-blue-200 rounded-lg px-3 py-1.5 text-gray-800 font-medium focus:outline-none focus:border-blue-400"
              />
            ) : (
              <p className="text-gray-800 font-medium">
                {profile.full_name || <span className="text-gray-400 italic">Not set</span>}
              </p>
            )}
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-2xl w-8 text-center">✉️</span>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Email</p>
            <p className="text-gray-500">{email}</p>
          </div>
        </div>

        {/* Weight */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-2xl w-8 text-center">⚖️</span>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Weight</p>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={draft.weight_lbs}
                  min={50}
                  max={500}
                  step={1}
                  onChange={(e) => setDraft({ ...draft, weight_lbs: parseFloat(e.target.value) || 140 })}
                  className="w-24 border-2 border-blue-200 rounded-lg px-3 py-1.5 text-gray-800 font-medium focus:outline-none focus:border-blue-400"
                />
                <span className="text-gray-500">lbs</span>
              </div>
            ) : (
              <p className="text-gray-800 font-medium">{profile.weight_lbs} lbs</p>
            )}
          </div>
          {!editing && (
            <p className="text-xs text-gray-400 text-right">Used for<br/>calorie estimates</p>
          )}
        </div>

        {/* Height */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-2xl w-8 text-center">📏</span>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Height</p>
            {editing ? (
              <div className="flex items-center gap-2">
                {/* Feet */}
                <input
                  type="number"
                  value={Math.floor(draft.height_in / 12)}
                  min={3}
                  max={8}
                  step={1}
                  onChange={(e) => {
                    const ft = parseInt(e.target.value) || 5;
                    const inches = Math.round(draft.height_in % 12);
                    setDraft({ ...draft, height_in: ft * 12 + inches });
                  }}
                  className="w-16 border-2 border-blue-200 rounded-lg px-2 py-1.5 text-gray-800 font-medium focus:outline-none focus:border-blue-400 text-center"
                />
                <span className="text-gray-500">ft</span>
                {/* Inches */}
                <input
                  type="number"
                  value={Math.round(draft.height_in % 12)}
                  min={0}
                  max={11}
                  step={1}
                  onChange={(e) => {
                    const inches = parseInt(e.target.value) || 0;
                    const ft = Math.floor(draft.height_in / 12);
                    setDraft({ ...draft, height_in: ft * 12 + inches });
                  }}
                  className="w-16 border-2 border-blue-200 rounded-lg px-2 py-1.5 text-gray-800 font-medium focus:outline-none focus:border-blue-400 text-center"
                />
                <span className="text-gray-500">in</span>
              </div>
            ) : (
              <p className="text-gray-800 font-medium">{inchesToDisplay(profile.height_in)}</p>
            )}
          </div>
          {!editing && (
            <p className="text-xs text-gray-400 text-right">Used for<br/>BMI calculation</p>
          )}
        </div>

        {/* Timezone */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-2xl w-8 text-center">🌍</span>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Timezone</p>
            {editing ? (
              <select
                value={draft.timezone}
                onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                className="w-full border-2 border-blue-200 rounded-lg px-3 py-1.5 text-gray-800 font-medium focus:outline-none focus:border-blue-400 bg-white"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{TZ_LABELS[tz] ?? tz}</option>
                ))}
              </select>
            ) : (
              <p className="text-gray-800 font-medium">
                {TZ_LABELS[profile.timezone] ?? profile.timezone}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="pt-2">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold hover:bg-red-50 disabled:opacity-60 transition-colors"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

    </div>
  );
}

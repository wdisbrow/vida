-- ============================================================
-- VIDA — Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Profiles ──────────────────────────────────────────────
-- Extends Supabase's built-in auth.users with app-specific fields
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name   TEXT,
  weight_lbs  NUMERIC DEFAULT 140,
  timezone    TEXT    DEFAULT 'America/New_York',
  units       TEXT    DEFAULT 'imperial',   -- imperial | metric
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();


-- ── 2. Entries ───────────────────────────────────────────────
-- Every logged activity (food, exercise, health, task)
CREATE TABLE IF NOT EXISTS entries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category     TEXT        NOT NULL CHECK (category IN ('food','exercise','health','task')),
  raw_text     TEXT        NOT NULL,
  parsed_data  JSONB       NOT NULL DEFAULT '{}',
  confidence   FLOAT       NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  source       TEXT        NOT NULL DEFAULT 'voice' CHECK (source IN ('voice','manual','wearable'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS entries_user_date
  ON entries (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS entries_category
  ON entries (user_id, category);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own entries"
  ON entries FOR ALL USING (auth.uid() = user_id);


-- ── 3. Goals ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  daily_calories      INT  DEFAULT 1800,
  daily_water_oz      INT  DEFAULT 64,
  daily_steps         INT  DEFAULT 8000,
  sleep_hours         NUMERIC DEFAULT 7.5,
  exercise_days_week  INT  DEFAULT 4,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own goals"
  ON goals FOR ALL USING (auth.uid() = user_id);


-- ── 4. Enable Realtime ───────────────────────────────────────
-- Allows the web app to receive live updates when entries are added
ALTER PUBLICATION supabase_realtime ADD TABLE entries;


-- ── Done! ─────────────────────────────────────────────────────
-- After running this, go to:
-- Supabase Dashboard → Authentication → Users → Add user
-- Create a user with your wife's email and a password.
-- That's the account she'll use to log in.

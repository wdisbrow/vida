import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Server-side Supabase uses the service role key (bypasses RLS for trusted API routes)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_GOALS = {
  daily_calories: 1800,
  daily_water_oz: 64,
  sleep_hours: 7.5,
  exercise_days_week: 4,
};

// GET /api/goals?userId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .single();

  // PGRST116 = no rows found — return defaults
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? DEFAULT_GOALS);
}

// PUT /api/goals — upsert goals for the user
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, daily_calories, daily_water_oz, sleep_hours, exercise_days_week } = body;

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    // Check if a row already exists for this user (avoids relying on a unique
    // constraint on user_id, which may not be defined in the DB schema)
    const { data: existing } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let data, error;

    if (existing?.id) {
      // Row exists — update it by primary key
      ({ data, error } = await supabase
        .from('goals')
        .update({ daily_calories, daily_water_oz, sleep_hours, exercise_days_week })
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      // No row yet — insert a fresh one
      ({ data, error } = await supabase
        .from('goals')
        .insert({ user_id: userId, daily_calories, daily_water_oz, sleep_hours, exercise_days_week })
        .select()
        .single());
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('Goals save error:', err);
    return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 });
  }
}

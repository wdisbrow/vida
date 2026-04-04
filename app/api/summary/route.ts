import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/summary?userId=xxx&days=7
// Returns all entries for the last N days (default 7), ordered ascending by occurred_at
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const days   = Math.min(parseInt(searchParams.get('days') || '7'), 30);

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('entries')
    .select('category, occurred_at, parsed_data')
    .eq('user_id', userId)
    .gte('occurred_at', start.toISOString())
    .order('occurred_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

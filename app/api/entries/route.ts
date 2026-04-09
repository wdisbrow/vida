import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Server-side Supabase uses the service role key (bypasses RLS for trusted API routes)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/entries?userId=xxx&date=2026-03-31
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId    = searchParams.get('userId');
  const date      = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const tzOffset  = parseInt(searchParams.get('tzOffset') || '0'); // minutes behind UTC (JS convention)

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  // Shift midnight boundaries by the client's UTC offset so we query local-day ranges
  const dayStart = new Date(`${date}T00:00:00Z`);
  dayStart.setMinutes(dayStart.getMinutes() + tzOffset);
  const dayEnd = new Date(`${date}T23:59:59Z`);
  dayEnd.setMinutes(dayEnd.getMinutes() + tzOffset);

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .gte('occurred_at', dayStart)
    .lte('occurred_at', dayEnd)
    .order('occurred_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/entries  — save a new entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, occurred_at, category, raw_text, parsed_data, confidence, source } = body;

    if (!user_id || !category || !raw_text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('entries')
      .insert({
        user_id,
        occurred_at: occurred_at || new Date().toISOString(),
        category,
        raw_text,
        parsed_data,
        confidence: confidence ?? 1.0,
        source: source ?? 'voice',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Save entry error:', err);
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}

// DELETE /api/entries?id=xxx
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

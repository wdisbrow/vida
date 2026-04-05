import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Vida, a friendly daily activity tracking assistant.
The user has spoken a message to log something they did today.
Extract the activity and return ONLY valid JSON — no explanation, no markdown, no code blocks.

Return this exact structure:
{
  "category": "food" | "exercise" | "health" | "task",
  "occurred_at": "<ISO 8601 timestamp — infer from context like 'this morning', default to now>",
  "parsed_data": { ...fields specific to the category... },
  "confidence": <0.0 to 1.0>,
  "needs_clarification": <true if confidence < 0.75>,
  "clarification_prompt": "<friendly question to ask if needs_clarification is true, else null>",
  "display_summary": "<one short line shown to user, e.g. 'Oatmeal with berries — 320 cal'>"
}

Category-specific parsed_data fields:

FOOD:
  foodName (string), quantity (string), grams (number, estimate if needed),
  mealType ("breakfast"|"lunch"|"dinner"|"snack"), calories (number, estimate from common portions),
  protein (grams), carbs (grams), fat (grams)

EXERCISE:
  activityType (string), duration (number), durationUnit ("minutes"|"hours"),
  intensity ("light"|"moderate"|"vigorous"),
  caloriesBurned (estimate using MET × userWeightKg × durationHours),
  metValue (number — walking=3.5, running=9.8, yoga=2.5, cycling=4.0, swimming=6.0)

HEALTH:
  metricType ("sleep"|"mood"|"weight"|"blood_pressure"|"medication"|"symptom"|"water"),
  value (number), unit (string), notes (string, optional),
  taken (boolean — for medication only),
  name (string — medication name if applicable)

TASK:
  taskName (string), status ("completed"|"pending"), taskCategory ("errand"|"appointment"|"chore"|"personal"),
  dueTime (ISO 8601 timestamp — extract if user mentions a time like "at 3pm", "by noon", "tomorrow morning"; omit if no time mentioned)

Rules:
- Always estimate calories for food if you can (use common serving sizes)
- For mood, scale is 1–10
- Be generous with confidence — everyday phrases should score > 0.8
- If the message contains multiple activities, pick the most prominent one`;

export async function POST(req: NextRequest) {
  try {
    const { transcript, datetime, weightLbs } = await req.json();

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    const userMessage = `
Current date/time: ${datetime || new Date().toISOString()}
User weight: ${weightLbs || 140} lbs

User said: "${transcript}"`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Strip any accidental markdown fences
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Parse entry error:', err);
    return NextResponse.json({ error: 'Failed to parse entry' }, { status: 500 });
  }
}

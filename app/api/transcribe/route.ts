import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as Blob | null;

    if (!audio) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.error('OPENAI_API_KEY is not set');
      return NextResponse.json({ error: 'Transcription service not configured' }, { status: 500 });
    }

    // Forward the audio to OpenAI Whisper
    const whisperForm = new FormData();
    whisperForm.append('file', audio, (formData.get('audio') as File)?.name ?? 'recording.webm');
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: whisperForm,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('OpenAI Whisper error:', err);
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json({ transcript: result.text ?? '' });

  } catch (err) {
    console.error('Transcribe route error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

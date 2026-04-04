'use client';
import { useState, useRef, useCallback } from 'react';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

interface UseVoiceReturn {
  state: VoiceState;
  setState: React.Dispatch<React.SetStateAction<VoiceState>>;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
  isSupported: boolean;
  micError: string | null;
}

export function useVoice(): UseVoiceReturn {
  const [state, setState]         = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [micError, setMicError]   = useState<string | null>(null);
  const mediaRecorderRef          = useRef<MediaRecorder | null>(null);
  const chunksRef                 = useRef<Blob[]>([]);

  // MediaRecorder is supported on all modern browsers including iOS Safari 14.5+
  const isSupported = typeof window !== 'undefined' &&
    !!(navigator.mediaDevices?.getUserMedia);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      setMicError(null);
      setTranscript('');
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick best supported format — iOS Safari requires audio/mp4
      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm' :
        'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Release the mic immediately
        stream.getTracks().forEach(t => t.stop());

        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size < 500) {
          setMicError('No speech detected. Tap the mic and speak clearly.');
          setState('error');
          return;
        }

        // Show spinner while we wait for transcription
        setState('processing');

        try {
          const formData = new FormData();
          const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
          formData.append('audio', blob, `recording.${ext}`);

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Transcription failed');
          }

          const { transcript: text } = await res.json();

          if (!text?.trim()) {
            setMicError('No speech detected. Try speaking more clearly.');
            setState('error');
            return;
          }

          // Setting transcript while state is already 'processing' triggers the
          // parse-entry effect in page.tsx (it re-runs when transcript changes)
          setTranscript(text);

        } catch (err) {
          console.error('Transcription error:', err);
          setMicError('Transcription failed. Please try again.');
          setState('error');
        }
      };

      mediaRecorder.start();
      setState('listening');

      // Safety: auto-stop after 30 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 30000);

    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMicError('Microphone access was denied. Please allow microphone access in your browser settings and try again.');
      } else {
        setMicError('Could not access microphone. Please try again.');
      }
      setState('error');
    }
  }, []);

  const reset = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setState('idle');
    setTranscript('');
    setMicError(null);
    chunksRef.current = [];
  }, []);

  return { state, setState, transcript, startListening, stopListening, reset, isSupported, micError };
}

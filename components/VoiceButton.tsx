'use client';
import { VoiceState } from '@/hooks/useVoice';

interface VoiceButtonProps {
  state: VoiceState;
  transcript: string;
  onPress: () => void;
}

export default function VoiceButton({ state, transcript, onPress }: VoiceButtonProps) {
  const isListening  = state === 'listening';
  const isProcessing = state === 'processing';
  const isIdle       = state === 'idle';
  const isError      = state === 'error';

  return (
    <div className="flex flex-col items-center gap-4">

      {/* Outer ring — pulses when listening */}
      <div className="relative flex items-center justify-center">
        {isListening && (
          <>
            <div className="absolute w-48 h-48 rounded-full bg-blue-400 opacity-20 animate-ping" />
            <div className="absolute w-40 h-40 rounded-full bg-blue-400 opacity-30 animate-ping" style={{ animationDelay: '0.3s' }} />
          </>
        )}

        {/* Main button */}
        <button
          onClick={onPress}
          disabled={isProcessing}
          className={`
            relative w-32 h-32 rounded-full flex items-center justify-center
            shadow-xl transition-all duration-300 active:scale-95
            ${isIdle       ? 'bg-blue-600 hover:bg-blue-700' : ''}
            ${isListening  ? 'bg-red-500 scale-110' : ''}
            ${isProcessing ? 'bg-yellow-500 cursor-not-allowed' : ''}
            ${isError      ? 'bg-amber-500' : ''}
          `}
          aria-label={isListening ? 'Stop recording' : 'Start recording'}
        >
          {/* Spinner for processing */}
          {isProcessing ? (
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
          ) : isError ? (
            <span className="text-4xl">⚠️</span>
          ) : (
            <MicIcon listening={isListening} />
          )}
        </button>
      </div>

      {/* Status label */}
      <div className="text-center min-h-[2rem]">
        {isIdle       && <p className="text-gray-500 text-lg">Tap to speak</p>}
        {isListening  && (
          <p className="text-red-500 text-lg font-medium animate-pulse">
            Recording… tap to stop
          </p>
        )}
        {isProcessing && <p className="text-yellow-600 text-lg font-medium">Got it, one sec…</p>}
        {isError      && <p className="text-amber-600 text-lg">Didn&apos;t catch that — try again?</p>}
      </div>
    </div>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="white"
      className={`w-12 h-12 transition-transform ${listening ? 'scale-110' : ''}`}
    >
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
      <path d="M19 10a1 1 0 0 1 2 0 9 9 0 0 1-18 0 1 1 0 0 1 2 0 7 7 0 0 0 14 0z" />
      <path d="M11 19.93V22h-2a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.07A9.01 9.01 0 0 1 3 11a1 1 0 1 1 2 0 7 7 0 0 0 14 0 1 1 0 1 1 2 0 9.01 9.01 0 0 1-8 8.93z" />
    </svg>
  );
}

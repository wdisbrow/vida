'use client';
import { useState } from 'react';
import { ParseResult } from '@/lib/types';
import { categoryEmoji } from '@/lib/utils';

interface ConfirmCardProps {
  result: ParseResult;
  onSave: () => void;
  onDiscard: () => void;
  onReanswer: (answer: string) => void;
  saving: boolean;
  reAnswering?: boolean;
}

export default function ConfirmCard({ result, onSave, onDiscard, onReanswer, saving, reAnswering = false }: ConfirmCardProps) {
  const emoji = categoryEmoji(result.category, result.parsed_data);
  const [textAnswer, setTextAnswer] = useState('');

  const handleTextSubmit = () => {
    const trimmed = textAnswer.trim();
    if (!trimmed) return;
    setTextAnswer('');
    onReanswer(trimmed);
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="bg-blue-600 px-5 py-3 flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <span className="text-white font-semibold text-lg capitalize">{result.category}</span>
        {result.confidence < 0.8 && (
          <span className="ml-auto text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-medium">
            Low confidence
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="px-5 py-4">
        <p className="text-gray-800 text-xl font-medium leading-snug">{result.display_summary}</p>

        {/* Clarification section */}
        {result.needs_clarification && result.clarification_prompt && (
          <div className="mt-3 bg-amber-50 rounded-xl px-3 py-3 space-y-3">
            <p className="text-amber-800 text-sm font-medium">
              ⚠️ {result.clarification_prompt}
            </p>

            {reAnswering ? (
              /* Loading state while re-parsing */
              <div className="flex items-center gap-2 py-1">
                <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-amber-700 text-sm">Updating…</span>
              </div>
            ) : result.clarification_options && result.clarification_options.length > 0 ? (
              /* Quick-answer chips */
              <div className="flex flex-wrap gap-2">
                {result.clarification_options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onReanswer(opt)}
                    disabled={reAnswering}
                    className="px-3 py-1.5 rounded-full bg-white border-2 border-amber-300 text-amber-800 text-sm font-semibold hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              /* Text fallback for open-ended questions */
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                  placeholder="Type your answer…"
                  disabled={reAnswering}
                  className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!textAnswer.trim() || reAnswering}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 text-white text-sm font-semibold disabled:opacity-40 hover:bg-amber-500 active:scale-95 transition-all"
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 flex gap-3">
        <button
          onClick={onDiscard}
          disabled={saving}
          className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-lg hover:bg-gray-50 transition-colors"
        >
          Discard
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Save ✓'
          )}
        </button>
      </div>
    </div>
  );
}

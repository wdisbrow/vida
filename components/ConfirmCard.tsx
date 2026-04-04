'use client';
import { ParseResult } from '@/lib/types';
import { categoryEmoji } from '@/lib/utils';

interface ConfirmCardProps {
  result: ParseResult;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}

export default function ConfirmCard({ result, onSave, onDiscard, saving }: ConfirmCardProps) {
  const emoji = categoryEmoji(result.category, result.parsed_data);

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

        {/* Show clarification if needed */}
        {result.needs_clarification && result.clarification_prompt && (
          <p className="mt-3 text-amber-700 text-sm bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ {result.clarification_prompt}
          </p>
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

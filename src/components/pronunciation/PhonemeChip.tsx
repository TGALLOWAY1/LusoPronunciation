import { memo, useState } from 'react';
import { getPhonemeById } from '@/lib/phonemeMetadata';
import { getScoreColor, getScoreBorderColor } from '@/lib/pronunciationDisplay';

interface PhonemeChipProps {
  symbol: string;
  score?: number;
}

/**
 * PhonemeChip displays a single phoneme symbol with metadata tooltip.
 * Shows IPA symbol, description, examples, and notes from phoneme_metadata.json.
 */
function PhonemeChip({ symbol, score }: PhonemeChipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const metadata = getPhonemeById(symbol);
  
  // Determine chip styling based on score (if provided)
  const chipClasses = score !== undefined
    ? `inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border-2 transition-colors ${getScoreColor(score)} ${getScoreBorderColor(score)}`
    : 'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border-2 transition-colors bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';

  // Prepare display values from metadata
  const ipa = metadata?.ipa || '';
  const description = metadata?.englishApprox || metadata?.articulation || '';
  const ptExamples = metadata?.exampleWords?.map(w => w.pt).join(', ') || '';
  const enExamples = metadata?.exampleWords?.map(w => w.english).join(', ') || '';
  const notes = metadata?.teachingTips?.[0] || '';

  // Build tooltip text for native title attribute (fallback)
  const tooltipText = metadata 
    ? `${symbol} → /${ipa}/\n${description}\n${enExamples ? `EN: ${enExamples}\n` : ''}${ptExamples ? `PT: ${ptExamples}` : ''}${score !== undefined ? `\nScore: ${Math.round(score)}/100` : ''}`
    : `${symbol}\nNo metadata available${score !== undefined ? `\nScore: ${Math.round(score)}/100` : ''}`;

  return (
    <span className="relative inline-block group">
      <span
        className={`${chipClasses} cursor-help`}
        title={tooltipText}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="font-mono">{symbol}</span>
        {metadata && (
          <span className="ml-1 text-xs opacity-75">/{ipa}/</span>
        )}
        {score !== undefined && (
          <span className="ml-1 text-xs opacity-75">({Math.round(score)})</span>
        )}
      </span>
      
      {/* Enhanced tooltip on hover */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 max-w-[calc(100vw-2rem)] p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none">
          {metadata ? (
            <div className="space-y-1.5">
              <div className="font-semibold text-sm border-b border-gray-700 pb-1">
                {symbol} → /{ipa}/
              </div>
              <div className="text-gray-300">{description}</div>
              {enExamples && (
                <div>
                  <strong className="text-gray-400">English:</strong>{' '}
                  <span className="text-gray-200">{enExamples}</span>
                </div>
              )}
              {ptExamples && (
                <div>
                  <strong className="text-gray-400">Portuguese:</strong>{' '}
                  <span className="text-gray-200">{ptExamples}</span>
                </div>
              )}
              {notes && (
                <div className="text-gray-400 italic mt-1 pt-1 border-t border-gray-700">
                  {notes}
                </div>
              )}
              {score !== undefined && (
                <div className="text-gray-300 mt-1 pt-1 border-t border-gray-700">
                  <strong>Score:</strong> {Math.round(score)}/100
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="font-semibold text-sm border-b border-gray-700 pb-1">{symbol}</div>
              <div className="text-gray-400 italic mt-1">No metadata available</div>
              {score !== undefined && (
                <div className="text-gray-300 mt-1 pt-1 border-t border-gray-700">
                  <strong>Score:</strong> {Math.round(score)}/100
                </div>
              )}
            </div>
          )}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45"></div>
          </div>
        </div>
      )}
    </span>
  );
}


export default memo(PhonemeChip);


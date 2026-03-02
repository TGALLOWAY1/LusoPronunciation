import { useMemo, useState } from 'react';
import {
  clearAttemptTelemetryRecords,
  computeMedian,
  computePercentile,
  readAttemptTelemetryRecords,
  type AttemptTelemetryRecord,
} from '@/lib/attemptMetrics';
import {
  clearSpeechServiceHealthRecord,
  readSpeechServiceHealthRecord,
} from '@/lib/speechServiceHealth';

function formatMs(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'N/A';
  }
  return `${Math.round(value)} ms`;
}

function formatRate(count: number, total: number): string {
  if (total === 0) {
    return '0.0%';
  }
  return `${((count / total) * 100).toFixed(1)}%`;
}

export default function DevMetricsPage() {
  const [attempts, setAttempts] = useState<AttemptTelemetryRecord[]>(() =>
    readAttemptTelemetryRecords()
  );
  const [speechHealth, setSpeechHealth] = useState(() => readSpeechServiceHealthRecord());
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const summary = useMemo(() => {
    const totalAttempts = attempts.length;
    const successfulAttempts = attempts.filter(
      (attempt) => !attempt.error.errorClass && !attempt.flags.canceled
    ).length;
    const convertFailures = attempts.filter((attempt) => {
      return (
        attempt.flags.fallbackUsed ||
        attempt.error.errorClass === 'server_convert_failed' ||
        attempt.error.errorClass === 'server_convert_timeout'
      );
    }).length;
    const fallbackUsageCount = attempts.filter((attempt) => attempt.flags.fallbackUsed).length;

    const feedbackTimes = attempts
      .map((attempt) => attempt.timeToFeedbackMs)
      .filter((value): value is number => typeof value === 'number');

    return {
      totalAttempts,
      successRate: formatRate(successfulAttempts, totalAttempts),
      p50: computeMedian(feedbackTimes),
      p95: computePercentile(feedbackTimes, 0.95),
      convertFailureRate: formatRate(convertFailures, totalAttempts),
      fallbackUsageRate: formatRate(fallbackUsageCount, totalAttempts),
    };
  }, [attempts]);

  const recentAttempts = useMemo(() => attempts.slice(0, 50), [attempts]);

  const handleClear = (): void => {
    clearAttemptTelemetryRecords();
    clearSpeechServiceHealthRecord();
    setAttempts([]);
    setSpeechHealth(null);
    setCopyStatus('idle');
  };

  const handleCopyJson = async (): Promise<void> => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not available');
      }
      await navigator.clipboard.writeText(JSON.stringify(attempts, null, 2));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 py-6">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
          Dev Metrics - latency and reliability diagnostics only
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Attempt Metrics</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Last {attempts.length} attempt telemetry records from local storage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyJson}
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-medium dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100"
            type="button"
          >
            Copy JSON
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
            type="button"
          >
            Clear Metrics
          </button>
        </div>
      </div>

      {copyStatus === 'copied' && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">Copied metrics JSON to clipboard.</p>
      )}
      {copyStatus === 'failed' && (
        <p className="text-sm text-red-700 dark:text-red-300">Failed to copy JSON from this browser context.</p>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Speech Service</p>
          <p
            className={`text-2xl font-bold ${
              speechHealth?.ok
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {speechHealth ? (speechHealth.ok ? 'Online' : 'Offline') : 'Unknown'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {speechHealth
              ? `Checked ${new Date(speechHealth.checkedAt).toLocaleString()}`
              : 'No login health check recorded yet'}
          </p>
          {!speechHealth?.ok && speechHealth?.errorClass && (
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
              errorClass: {speechHealth.errorClass}
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Attempts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalAttempts}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.successRate}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">p50 Time to Feedback</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatMs(summary.p50)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">p95 Time to Feedback</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatMs(summary.p95)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Convert Failure Rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.convertFailureRate}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Fallback Usage Rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.fallbackUsageRate}</p>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Last 50 Attempts</h2>
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Created</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">TTF</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Convert</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Azure</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Normalize</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Flags</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Error Class</th>
            </tr>
          </thead>
          <tbody>
            {recentAttempts.map((attempt) => (
              <tr
                key={`${attempt.attemptId}-${attempt.createdAt}`}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                  {new Date(attempt.createdAt).toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                  {formatMs(attempt.timeToFeedbackMs)}
                </td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                  {formatMs(attempt.serverTimingsMs.convertMs)}
                </td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                  {formatMs(attempt.serverTimingsMs.azureMs)}
                </td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                  {formatMs(attempt.serverTimingsMs.normalizeMs)}
                </td>
                <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                  {attempt.flags.fallbackUsed ? 'fallback' : '-'}
                  {attempt.flags.canceled ? ' canceled' : ''}
                </td>
                <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                  {attempt.error.errorClass ?? '-'}
                </td>
              </tr>
            ))}
            {recentAttempts.length === 0 && (
              <tr>
                <td
                  className="py-8 px-3 text-center text-gray-500 dark:text-gray-400"
                  colSpan={7}
                >
                  No metrics recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

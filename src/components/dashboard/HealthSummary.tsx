import { useState, useEffect } from 'react';
import type { HealthSummary as HealthSummaryType } from '@/types/health';

export function HealthSummary() {
  const [summary] = useState<HealthSummaryType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch health summary from Amplify Data
    // For now, use placeholder
    setLoading(false);
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Health Summary
        </h2>
        <button className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
          Generate New Summary
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
        </div>
      ) : !summary ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="mt-4 text-base font-medium text-gray-900 dark:text-white">
            No health summary yet
          </h3>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
            Generate your first AI-powered health summary to get insights into your wellness journey.
          </p>
          <button className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-base">
            Generate Summary
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {summary.period} Summary
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(summary.generatedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {summary.summary}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


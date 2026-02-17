import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { HealthMetric } from '@/types/health';
import {
  listStoredMetrics,
  regenerateAndStoreMetrics,
} from '@/lib/health-tracker';

export function MetricsWidget() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMetrics = async () => {
    setError('');
    setLoading(true);
    try {
      const stored = await listStoredMetrics();
      if (stored.length > 0) {
        setMetrics(stored);
      } else {
        const generated = await regenerateAndStoreMetrics();
        setMetrics(generated);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to generate metrics right now.');
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshFromChat = async () => {
    setError('');
    setLoading(true);
    try {
      const refreshed = await regenerateAndStoreMetrics();
      setMetrics(refreshed);
    } catch (err: any) {
      setError(err.message || 'Unable to refresh metrics right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Health Metrics
        </h2>
        <button
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 disabled:opacity-60"
          onClick={handleRefreshFromChat}
          disabled={loading}
        >
          Refresh from Chat
        </button>
      </div>
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      ) : metrics.length === 0 ? (
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No chat-based metrics yet. Complete guided intake and ask a few health questions.
          </p>
          <Link
            to="/ai-agent?guided=1"
            className="mt-4 inline-flex items-center px-4 py-2 border border-primary-500 text-primary-600 dark:text-primary-400 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 text-sm"
          >
            Start Guided Intake
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {metric.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {metric.date}
                </p>
                {metric.notes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {metric.notes}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                  {metric.value || '-'} {metric.unit || ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


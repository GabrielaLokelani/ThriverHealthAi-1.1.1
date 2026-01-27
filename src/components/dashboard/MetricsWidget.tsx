import { useState, useEffect } from 'react';
import type { HealthMetric } from '@/types/health';

export function MetricsWidget() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch metrics from Amplify Data
    // For now, use placeholder data
    setMetrics([]);
    setLoading(false);
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Health Metrics
      </h2>
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
            No metrics recorded yet. Start tracking your health metrics!
          </p>
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
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                  {metric.value} {metric.unit}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="mt-4 w-full px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
        Add Metric
      </button>
    </div>
  );
}


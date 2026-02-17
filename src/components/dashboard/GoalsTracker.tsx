import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Goal } from '@/types/health';
import {
  listStoredGoals,
  regenerateAndStoreGoals,
  toggleStoredGoal,
} from '@/lib/health-tracker';

export function GoalsTracker() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGoals = async () => {
    setError('');
    setLoading(true);
    try {
      const stored = await listStoredGoals();
      if (stored.length > 0) {
        setGoals(stored);
      } else {
        const generated = await regenerateAndStoreGoals();
        setGoals(generated);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to generate goals right now.');
      setGoals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshFromChat = async () => {
    setError('');
    setLoading(true);
    try {
      const refreshed = await regenerateAndStoreGoals();
      setGoals(refreshed);
    } catch (err: any) {
      setError(err.message || 'Unable to refresh goals right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const toggleGoalCompletion = async (goalId: string) => {
    const selected = goals.find((goal) => goal.id === goalId);
    if (!selected) return;

    try {
      const updated = await toggleStoredGoal(selected);
      setGoals((prev) =>
        prev.map((goal) => (goal.id === goalId ? updated : goal))
      );
    } catch {
      // Keep current UI state if persistence fails.
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Goals
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
      ) : goals.length === 0 ? (
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No goals found yet. Complete guided intake and ask about what you want to improve.
          </p>
          <Link
            to="/ai-agent?guided=1"
            className="mt-4 inline-flex items-center px-4 py-2 border border-primary-500 text-primary-600 dark:text-primary-400 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 text-sm"
          >
            Start Guided Intake
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <input
                type="checkbox"
                checked={goal.completed}
                onChange={() => toggleGoalCompletion(goal.id)}
                aria-label={`Mark goal "${goal.title}" as complete`}
                title={`Toggle completion for ${goal.title}`}
                className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    goal.completed
                      ? 'line-through text-gray-500 dark:text-gray-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {goal.title}
                </p>
                {goal.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {goal.description}
                  </p>
                )}
                {goal.targetDate && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Target: {new Date(goal.targetDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


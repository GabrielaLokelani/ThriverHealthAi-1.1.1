import { Link } from 'react-router-dom';
import { MetricsWidget } from './MetricsWidget';
import { GoalsTracker } from './GoalsTracker';
import { GratitudeJournal } from './GratitudeJournal';
import { TasksManager } from './TasksManager';
import { HealthSummary } from './HealthSummary';

export function Dashboard() {
  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-base text-gray-500 dark:text-gray-400">
          Welcome back! Here's an overview of your health journey.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Chat with your Thriver Advisor
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Ask health questions, summarize progress, and get personalized guidance.
              </p>
            </div>
            <Link
              to="/ai-agent"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg shadow transition"
            >
              Open AI Agent
            </Link>
          </div>
        </div>
        <div className="lg:col-span-2">
          <HealthSummary />
        </div>
        <MetricsWidget />
        <GoalsTracker />
        <GratitudeJournal />
        <TasksManager />
      </div>
    </div>
  );
}


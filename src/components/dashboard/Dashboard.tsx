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


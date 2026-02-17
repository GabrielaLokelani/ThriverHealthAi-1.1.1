import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { MetricsWidget } from './MetricsWidget';
import { GoalsTracker } from './GoalsTracker';
import { GratitudeJournal } from './GratitudeJournal';
import { TasksManager } from './TasksManager';
import { HealthSummary } from './HealthSummary';
import { getCurrentUserProfile } from '@/lib/profile';

export function Dashboard() {
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadFirstName = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (cancelled) return;
        const name = profile?.name?.trim()?.split(/\s+/)?.[0] || '';
        setFirstName(name);
      } catch {
        if (!cancelled) {
          setFirstName('');
        }
      }
    };

    loadFirstName();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 pb-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
        This app is experimental and in beta testing. Thank you for your patience as features
        may change.
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {firstName ? `${firstName}'s Dashboard` : 'Dashboard'}
        </h1>
        <p className="mt-1 text-base text-gray-500 dark:text-gray-400">
          Welcome back{firstName ? `, ${firstName}` : ''}! Here's an overview of your health
          journey.
        </p>
      </div>

      <div className="rounded-xl border border-primary-200 bg-primary-50 dark:border-primary-900/40 dark:bg-primary-900/20 p-5">
        <p className="text-sm font-semibold text-primary-800 dark:text-primary-200">Next step</p>
        <p className="mt-1 text-sm text-primary-700 dark:text-primary-300">
          Open your AI Chat Assistant and ask one health question to keep your summary up to date.
        </p>
        <Link
          to="/ai-agent"
          className="mt-3 inline-flex items-center justify-center px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        >
          Go to AI Chat Assistant
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Start with your Thriver AI Advisor
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Ask questions, capture updates, and turn your notes into clear next steps.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/ai-agent?guided=1"
                className="inline-flex items-center justify-center px-5 py-2.5 border border-primary-500 text-primary-600 dark:text-primary-400 font-semibold rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
              >
                Start Guided Intake Now
              </Link>
            </div>
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


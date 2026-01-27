import { useState, useEffect } from 'react';
import type { GratitudeEntry } from '@/types/health';

export function GratitudeJournal() {
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState('');

  useEffect(() => {
    // TODO: Fetch gratitude entries from Amplify Data
    setEntries([]);
    setLoading(false);
  }, []);

  const handleAddEntry = async () => {
    if (!newEntry.trim()) return;

    // TODO: Save entry to backend
    const entry: GratitudeEntry = {
      id: Date.now().toString(),
      content: newEntry,
      date: new Date().toISOString().split('T')[0],
    };

    setEntries([entry, ...entries]);
    setNewEntry('');
    setShowAddForm(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Gratitude Journal
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          {showAddForm ? 'Cancel' : 'Add Entry'}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-4">
          <textarea
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            placeholder="What are you grateful for today?"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={handleAddEntry}
            className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
          >
            Save Entry
          </button>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      ) : entries.length === 0 ? (
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
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No gratitude entries yet. Start your gratitude journal!
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <p className="text-gray-900 dark:text-white">{entry.content}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {new Date(entry.date).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


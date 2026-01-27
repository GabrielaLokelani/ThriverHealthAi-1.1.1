import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/lib/hooks/useAuth';

export function Header() {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    if (!user) {
      setDisplayName('');
      return;
    }

    // Try to get user's name from localStorage (stored during profile setup/onboarding)
    const profileData = localStorage.getItem('userProfile');
    if (profileData) {
      try {
        const profile = JSON.parse(profileData);
        if (profile.name && profile.name.trim()) {
          // Extract first name (everything before the first space)
          const firstName = profile.name.trim().split(' ')[0];
          setDisplayName(firstName);
          return;
        }
      } catch (e) {
        // Invalid JSON, ignore
        console.error('Error parsing profile data:', e);
      }
    }
    
    // If no profile data found, don't display anything yet
    // User will see their name after completing onboarding
    setDisplayName('');
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img
                src="/thriver-text.svg"
                alt="ThriverHealth.AI"
                className="h-20 md:h-24 lg:h-28 w-auto hidden sm:block"
              />
              <img
                src="/thriver-head.svg"
                alt="ThriverHealth.AI"
                className="h-7 md:h-8 w-auto"
              />
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {user && (
              <div className="flex items-center space-x-4">
                {displayName && (
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {displayName}
                  </span>
                )}
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}


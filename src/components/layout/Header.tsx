import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCurrentUserProfile } from '@/lib/profile';

export function Header() {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const resolveDisplayName = async () => {
      if (!user) {
        setDisplayName('');
        return;
      }

      try {
        const profile = await getCurrentUserProfile();
        if (cancelled) return;
        const firstName = profile?.name?.trim()?.split(/\s+/)?.[0];
        if (firstName) {
          setDisplayName(firstName);
          return;
        }
      } catch {
        // Fall back to auth values below when profile fetch fails.
      }

      const emailFirstPart = user.email?.split('@')[0]?.trim();
      if (emailFirstPart) {
        setDisplayName(emailFirstPart);
        return;
      }

      setDisplayName(user.username || '');
    };

    resolveDisplayName();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch {
      // Avoid exposing auth errors in browser logs.
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img
                src="/thriver-text-light.svg"
                alt="ThriverHealth.AI"
                className="h-20 md:h-24 lg:h-28 w-auto hidden sm:block dark:hidden"
              />
              <img
                src="/thriver-text.svg"
                alt="ThriverHealth.AI"
                className="h-20 md:h-24 lg:h-28 w-auto hidden sm:dark:block"
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


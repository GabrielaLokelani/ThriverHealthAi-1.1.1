import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/hooks/useAuth';

export function SignIn() {
  const navigate = useNavigate();
  const { signIn, user, signOut, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user is already signed in and handle it
  useEffect(() => {
    if (user) {
      // User is already signed in, check if profile is completed
      const hasCompletedProfile = localStorage.getItem('profileCompleted');
      if (!hasCompletedProfile) {
        navigate('/profile-setup');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // If there's already a signed-in user, sign them out first
      if (user) {
        await signOut();
      }

      const result = await signIn(formData.email, formData.password);
      
      if (result.isSignedIn) {
        // Wait for auth state to update - refresh user state
        await refreshUser();
        // Give it a moment to update
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check if user has completed profile (for now, check localStorage)
        // In production, this should check the database
        const hasCompletedProfile = localStorage.getItem('profileCompleted');
        console.log('✅ Sign-in successful!');
        console.log('👤 User state:', user ? 'authenticated' : 'not authenticated');
        console.log('📋 Profile completed status:', hasCompletedProfile);
        console.log('🔍 Checking if onboarding is needed...');
        
        if (!hasCompletedProfile || hasCompletedProfile !== 'true') {
          console.log('➡️  Redirecting to profile-setup for onboarding');
          // Clear any old profile data to ensure fresh start
          localStorage.removeItem('userProfile');
          // Use window.location to force a full page reload and ensure auth state is set
          window.location.href = '/profile-setup';
        } else {
          console.log('✅ Profile already completed, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
        }
      } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        navigate('/confirm-totp', { state: { email: formData.email } });
      } else {
        navigate('/profile-setup');
      }
    } catch (err: any) {
      // Handle the "already signed in" error specifically
      if (err.message?.includes('already a signed in user') || err.name === 'UserAlreadyAuthenticatedException') {
        // Sign out the existing user and try again
        try {
          await signOut();
          setError('Please try signing in again.');
        } catch (signOutErr) {
          setError('There was an issue with your session. Please refresh the page and try again.');
        }
      } else {
        setError(err.message || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-500">
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


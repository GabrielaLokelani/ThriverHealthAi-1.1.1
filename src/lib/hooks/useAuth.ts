import { useState, useEffect } from 'react';
import { getCurrentUser, signIn, signUp, confirmSignUp, signOut } from 'aws-amplify/auth';

interface User {
  userId: string;
  username: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      // Only try to get user if Amplify is configured
      // For now, just set loading to false since Amplify isn't configured
      const currentUser = await getCurrentUser();
      setUser({
        userId: currentUser.userId,
        username: currentUser.username,
      });
    } catch (error) {
      // Amplify not configured or user not signed in - this is expected
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(username: string, password: string, email: string) {
    try {
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });

      return { isSignUpComplete, userId, nextStep };
    } catch (error) {
      throw error;
    }
  }

  async function handleConfirmSignUp(username: string, confirmationCode: string) {
    try {
      const { isSignUpComplete, nextStep } = await confirmSignUp({
        username,
        confirmationCode,
      });

      return { isSignUpComplete, nextStep };
    } catch (error) {
      throw error;
    }
  }

  async function handleSignIn(username: string, password: string) {
    try {
      const { isSignedIn, nextStep } = await signIn({
        username,
        password,
      });

      if (isSignedIn) {
        await checkUser();
      }

      return { isSignedIn, nextStep };
    } catch (error) {
      throw error;
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      throw error;
    }
  }

  return {
    user,
    loading,
    signUp: handleSignUp,
    confirmSignUp: handleConfirmSignUp,
    signIn: handleSignIn,
    signOut: handleSignOut,
    refreshUser: checkUser,
  };
}


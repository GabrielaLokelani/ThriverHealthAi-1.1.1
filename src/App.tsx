import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { LandingPage } from '@/components/landing/LandingPage';
import { SignUp } from '@/components/auth/SignUp';
import { SignIn } from '@/components/auth/SignIn';
import { ConfirmSignUp } from '@/components/auth/ConfirmSignUp';
import { ProfileSetup } from '@/components/auth/ProfileSetup';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { AIAgent } from '@/components/ai-agent/AIAgent';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuth } from '@/lib/hooks/useAuth';
import { configureAmplify } from '@/lib/amplify';

// Configure Amplify
configureAmplify();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/confirm-signup" element={<ConfirmSignUp />} />
          <Route
            path="/profile-setup"
            element={
              <ProtectedRoute>
                <ProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-agent"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AIAgent />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Documents
                      </h1>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Upload and manage your health documents
                      </p>
                    </div>
                    <DocumentUpload />
                    <DocumentList />
                  </div>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

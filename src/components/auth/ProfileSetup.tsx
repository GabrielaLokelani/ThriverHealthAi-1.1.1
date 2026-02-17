import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PolicyAcceptance } from './PolicyAcceptance';
import { useAuth } from '@/lib/hooks/useAuth';
import { upsertCurrentUserProfile } from '@/lib/profile';

interface ProfileData {
  name: string;
  email: string;
  dateOfBirth: string;
  privacyPolicyAccepted: boolean;
  termsOfUseAccepted: boolean;
}

export function ProfileSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ProfileData>({
    name: '',
    email: user?.email || '',
    dateOfBirth: '',
    privacyPolicyAccepted: false,
    termsOfUseAccepted: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.email && !formData.email) {
      setFormData((prev) => ({ ...prev, email: user.email || '' }));
    }
  }, [user?.email, formData.email]);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    if (step === 1 && (!formData.name || !formData.dateOfBirth || !formData.email)) {
      setError('Please complete your first name, date of birth, and email to continue.');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const handlePrevious = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await upsertCurrentUserProfile({
        email: formData.email,
        name: formData.name,
        dateOfBirth: formData.dateOfBirth,
        profileCompleted: true,
      });
      localStorage.setItem('guidedIntakeStatus', 'pending');

      // Send users directly to optional guided first chat.
      navigate('/ai-agent?guided=1');
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving your profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              Complete Your Profile
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Step {step} of 2: {step === 1 ? 'Basic Information' : 'Policies & Agreements'}
            </p>
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Welcome!</strong> We keep onboarding lightweight. You can share more in a
                guided AI chat after setup.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter your first name"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    required
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This helps tailor guidance for your age group.
                  </p>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!formData.name || !formData.dateOfBirth || !formData.email}
                    className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <PolicyAcceptance
                  privacyAccepted={formData.privacyPolicyAccepted}
                  termsAccepted={formData.termsOfUseAccepted}
                  onPrivacyAccept={(accepted) => {
                    setFormData({
                      ...formData,
                      privacyPolicyAccepted: accepted,
                    });
                  }}
                  onTermsAccept={(accepted) => {
                    setFormData({
                      ...formData,
                      termsOfUseAccepted: accepted,
                    });
                  }}
                />
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !formData.privacyPolicyAccepted || !formData.termsOfUseAccepted}
                    className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Complete Setup'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}


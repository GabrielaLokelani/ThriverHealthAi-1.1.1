import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PolicyAcceptance } from './PolicyAcceptance';

interface ProfileData {
  name: string;
  dateOfBirth: string;
  disease: string;
  diagnosis: string;
  currentTreatments: string;
  treatmentGoals: string;
  initialSymptoms: string;
  privacyPolicyAccepted: boolean;
  termsOfUseAccepted: boolean;
}

export function ProfileSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  useEffect(() => {
    console.log('ProfileSetup component mounted. Step:', step);
  }, [step]);
  const [formData, setFormData] = useState<ProfileData>({
    name: '',
    dateOfBirth: '',
    disease: '',
    diagnosis: '',
    currentTreatments: '',
    treatmentGoals: '',
    initialSymptoms: '',
    privacyPolicyAccepted: false,
    termsOfUseAccepted: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    if (step === 1 && (!formData.name || !formData.dateOfBirth)) {
      setError('Please fill in all required fields');
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
      // TODO: Save profile data to backend
      // This will be implemented when connecting to Amplify Data
      console.log('Profile data:', formData);
      
      // Save profile data to localStorage for now (until backend is connected)
      localStorage.setItem('userProfile', JSON.stringify(formData));
      
      // Mark profile as completed (in production, this should be saved to database)
      localStorage.setItem('profileCompleted', 'true');
      
      // Navigate to dashboard
      navigate('/dashboard');
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
              Step {step} of 4: {step === 1 ? 'Basic Information' : step === 2 ? 'Health Information' : step === 3 ? 'Treatment Goals' : 'Policies & Agreements'}
            </p>
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Welcome!</strong> Let's get started with your health journey. This will only take a few minutes.
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
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
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
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="disease" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Disease/Condition
                  </label>
                  <input
                    type="text"
                    id="disease"
                    value={formData.disease}
                    onChange={(e) => handleInputChange('disease', e.target.value)}
                    placeholder="e.g., Cancer, Diabetes, etc."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="diagnosis" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Diagnosis Details
                  </label>
                  <textarea
                    id="diagnosis"
                    rows={3}
                    value={formData.diagnosis}
                    onChange={(e) => handleInputChange('diagnosis', e.target.value)}
                    placeholder="Provide details about your diagnosis..."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="currentTreatments" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Current Treatments
                  </label>
                  <textarea
                    id="currentTreatments"
                    rows={3}
                    value={formData.currentTreatments}
                    onChange={(e) => handleInputChange('currentTreatments', e.target.value)}
                    placeholder="List any current treatments or medications..."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="initialSymptoms" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Initial Symptoms
                  </label>
                  <textarea
                    id="initialSymptoms"
                    rows={3}
                    value={formData.initialSymptoms}
                    onChange={(e) => handleInputChange('initialSymptoms', e.target.value)}
                    placeholder="Describe your initial symptoms..."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="treatmentGoals" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Treatment Goals
                  </label>
                  <textarea
                    id="treatmentGoals"
                    rows={4}
                    value={formData.treatmentGoals}
                    onChange={(e) => handleInputChange('treatmentGoals', e.target.value)}
                    placeholder="What are your goals for treatment? What outcomes are you hoping to achieve?"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
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


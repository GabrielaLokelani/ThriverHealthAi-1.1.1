import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Video Background */}
      <section className="relative h-screen min-h-[420px] bg-black overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-contain"
          src="/ThriverLandingPageVideo.mp4?v=2"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-0 bg-black/20" />
      </section>

      {/* Content Section */}
      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <p className="text-xs md:text-sm tracking-[0.3em] uppercase text-gray-500 dark:text-gray-400">
              <span>Thriver</span>
              <span className="text-primary-500 dark:text-primary-400">Health</span>
              <span>.AI</span>
            </p>
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              This app is experimental and in beta testing. Thank you for your patience as
              features may change.
            </div>
            <p className="mt-4 text-lg md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Your AI-powered health companion for researching diseases, tracking treatments,
              and managing your wellness journey with confidence and clarity.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/signup"
                className="px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg transform transition hover:scale-105"
              >
                Start Free Trial
              </Link>
              <Link
                to="/signin"
                className="px-8 py-4 bg-white dark:bg-gray-800 border-2 border-primary-500 text-primary-500 dark:text-primary-400 font-semibold rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transform transition hover:scale-105"
              >
                Sign In
              </Link>
            </div>
          </div>

        {/* Features Grid */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              AI-Powered Research
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Get comprehensive insights on diseases, treatments, and alternative therapies powered by advanced AI.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Health Tracking
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Track your progress, goals, and metrics with our intuitive dashboard designed for your wellness journey.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Document Management
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Securely upload and manage your health documents, lab results, and medical records with HIPAA compliance.
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}


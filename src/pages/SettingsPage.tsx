import { useSettingsStore } from '@/state/settingsStore';

export default function SettingsPage() {
  const { selectedVoice, setSelectedVoice } = useSettingsStore();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Settings
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Audio and voice preferences
        </p>
      </div>

      {/* Voice Preference */}
      <section className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Preferred Voice
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose the native speaker voice used for audio examples.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedVoice('male')}
            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all text-center ${
              selectedVoice === 'male'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            Male
          </button>
          <button
            onClick={() => setSelectedVoice('female')}
            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all text-center ${
              selectedVoice === 'female'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            Female
          </button>
        </div>
      </section>

      {/* Microphone section placeholder */}
      <section className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Microphone
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Microphone access is requested when you start a recording. Make sure your browser
          has permission to use the microphone.
        </p>
      </section>
    </div>
  );
}

import { useSettingsStore } from '@/state/settingsStore';

interface VoiceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Voice settings modal/dropdown for selecting preferred word voice.
 * Uses the global settings store for voice selection.
 */
export default function VoiceSettings({ isOpen, onClose }: VoiceSettingsProps) {
  const { selectedVoice, setSelectedVoice } = useSettingsStore();

  const handleVoiceChange = (voice: typeof selectedVoice) => {
    setSelectedVoice(voice);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Voice Settings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred Voice
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleVoiceChange('male')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                  selectedVoice === 'male'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                👨 Male
              </button>
              <button
                onClick={() => handleVoiceChange('female')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                  selectedVoice === 'female'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                👩 Female
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/**
 * Word Audio Path Utilities
 * 
 * Helper functions for resolving TTS-generated word audio file paths.
 * These paths match the naming convention used by the generateWordAudio.ts script.
 */

export type WordVoice = 'male' | 'female';

/**
 * Get the audio path for a word's TTS-generated audio file.
 * 
 * @param wordId - The word ID from words.json (e.g., "basic_001", "food_word_001")
 * @param voice - The voice type (male or female)
 * @returns The path to the audio file (e.g., "/audio/words/basic_001_male.wav")
 */
export function getWordAudioPath(wordId: string, voice: WordVoice = 'male'): string {
  return `/audio/words/${wordId}_${voice}.wav`;
}


import { useEffect, useState } from 'react';
import type { Word } from '@/lib/types';
import { loadAllWords } from '@/lib/data';

let cachedWordMap: Map<string, Word> | null = null;
let loadingPromise: Promise<Map<string, Word>> | null = null;

function buildWordMap(words: Word[]): Map<string, Word> {
  return new Map(words.map(word => [word.id, word]));
}

/**
 * Lazily loads the canonical word dataset (masterWords.json) and returns a map keyed by word ID.
 * The data is cached across hook invocations to avoid duplicate fetches.
 */
export function useCanonicalWordMap(): Map<string, Word> | null {
  const [wordMap, setWordMap] = useState<Map<string, Word> | null>(cachedWordMap);

  useEffect(() => {
    if (cachedWordMap) {
      setWordMap(cachedWordMap);
      return;
    }

    if (!loadingPromise) {
      loadingPromise = loadAllWords()
        .then(words => {
          cachedWordMap = buildWordMap(words);
          return cachedWordMap;
        })
        .catch(error => {
          console.error('[useCanonicalWordMap] Failed to load canonical words:', error);
          loadingPromise = null;
          throw error;
        });
    }

    loadingPromise
      ?.then(map => {
        setWordMap(map);
      })
      .catch(error => {
        console.error('[useCanonicalWordMap] Failed to resolve canonical words:', error);
      });
  }, []);

  return wordMap;
}


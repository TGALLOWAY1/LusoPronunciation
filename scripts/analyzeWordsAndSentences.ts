#!/usr/bin/env node

/**
 * Word & Sentence Corpus Analysis Script
 * 
 * Analyzes words.json and sentences.json to:
 * - Find unique words in words.json
 * - Find unique tokens used in sentences
 * - Identify tokens used in sentences but missing from words.json
 */

import * as fs from 'fs';
import * as path from 'path';

// Types matching the actual JSON structure
type WordEntry = {
  id: string;
  pt: string;
  en: string;
  pos?: string;
  difficulty?: number;
  difficult_for_english?: boolean;
  pronunciation_notes?: string;
};

type SentenceEntry = {
  id: string;
  pt: string;
  en: string;
  difficulty?: number;
  pronunciation_notes?: string;
};

type WordsJson = {
  language_pair: string;
  version: string;
  categories: Array<{
    id: string;
    label_en: string;
    label_pt: string;
    words: WordEntry[];
  }>;
};

type SentencesJson = {
  language_pair: string;
  version: string;
  categories: Array<{
    id: string;
    label_en: string;
    label_pt: string;
    sentences: SentenceEntry[];
  }>;
};

/**
 * Normalize a token by:
 * - Converting to lowercase
 * - Removing punctuation
 * - Normalizing whitespace
 * - Preserving Portuguese diacritics
 */
function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"()…«»""'']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Load and parse JSON file
 */
function loadJson<T>(filePath: string): T {
  const fullPath = path.resolve(__dirname, '..', filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Extract all word entries from the nested structure
 */
function extractWords(data: WordsJson): WordEntry[] {
  const words: WordEntry[] = [];
  for (const category of data.categories) {
    words.push(...category.words);
  }
  return words;
}

/**
 * Extract all sentence entries from the nested structure
 */
function extractSentences(data: SentencesJson): SentenceEntry[] {
  const sentences: SentenceEntry[] = [];
  for (const category of data.categories) {
    sentences.push(...category.sentences);
  }
  return sentences;
}

/**
 * Main analysis function
 */
function main() {
  console.log('📊 Word & Sentence Corpus Analysis\n');
  console.log('=' .repeat(60) + '\n');

  // Load data files
  console.log('Loading data files...');
  const wordsData = loadJson<WordsJson>('STATIC DATA/words.json');
  const sentencesData = loadJson<SentencesJson>('STATIC DATA/sentences.json');
  console.log('✅ Data loaded successfully\n');

  // Extract all entries
  const wordEntries = extractWords(wordsData);
  const sentenceEntries = extractSentences(sentencesData);

  // Build set of unique normalized words from words.json
  const wordsFromWordsJson = new Set<string>();
  const wordsByNormalized = new Map<string, WordEntry[]>();

  for (const entry of wordEntries) {
    // Handle multi-word entries (e.g., "bom dia")
    const tokens = entry.pt.split(/\s+/);
    for (const token of tokens) {
      const normalized = normalizeToken(token);
      if (normalized) {
        wordsFromWordsJson.add(normalized);
        
        // Track entries for debugging duplicates
        if (!wordsByNormalized.has(normalized)) {
          wordsByNormalized.set(normalized, []);
        }
        wordsByNormalized.get(normalized)!.push(entry);
      }
    }
  }

  // Build set of unique normalized tokens from sentences
  const wordsFromSentences = new Set<string>();
  const missingBySentence: Record<string, Set<string>> = {};

  for (const sentence of sentenceEntries) {
    const tokens = sentence.pt.split(/\s+/);
    const sentenceMissing = new Set<string>();

    for (const token of tokens) {
      const normalized = normalizeToken(token);
      if (normalized) {
        wordsFromSentences.add(normalized);
        
        // Check if this token exists in words.json
        if (!wordsFromWordsJson.has(normalized)) {
          sentenceMissing.add(normalized);
        }
      }
    }

    if (sentenceMissing.size > 0) {
      missingBySentence[sentence.id] = sentenceMissing;
    }
  }

  // Compute missing and unused words
  const missingTokens = new Set<string>();
  for (const sentenceId in missingBySentence) {
    for (const token of missingBySentence[sentenceId]) {
      missingTokens.add(token);
    }
  }

  const unusedWords = new Set<string>();
  for (const word of wordsFromWordsJson) {
    if (!wordsFromSentences.has(word)) {
      unusedWords.add(word);
    }
  }

  // Print summary statistics
  console.log('📈 Summary Statistics');
  console.log('-'.repeat(60));
  console.log(`Total entries in words.json: ${wordEntries.length}`);
  console.log(`Unique normalized tokens in words.json: ${wordsFromWordsJson.size}`);
  console.log(`Total entries in sentences.json: ${sentenceEntries.length}`);
  console.log(`Unique normalized tokens from sentences: ${wordsFromSentences.size}`);
  console.log(`Missing tokens (used in sentences but not in words.json): ${missingTokens.size}`);
  console.log(`Unused words (in words.json but not in sentences): ${unusedWords.size}`);
  console.log('');

  // Print sample of WordEntry structure
  console.log('📋 Sample WordEntry Structure (first 3 entries):');
  console.log('-'.repeat(60));
  console.log(JSON.stringify(wordEntries.slice(0, 3), null, 2));
  console.log('');

  // Print missing tokens if any
  if (missingTokens.size > 0) {
    console.log('❌ Missing word entries for tokens used in sentences:');
    console.log('='.repeat(60));
    
    // Group by sentence for better readability
    for (const sentence of sentenceEntries) {
      if (sentence.id in missingBySentence) {
        const missing = Array.from(missingBySentence[sentence.id]);
        if (missing.length > 0) {
          console.log(`\nSentence ID: ${sentence.id}`);
          console.log(`Portuguese: ${sentence.pt}`);
          console.log(`Missing tokens: ${missing.join(', ')}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n⚠️  Total unique missing tokens: ${missingTokens.size}`);
    console.log(`   Tokens: ${Array.from(missingTokens).sort().join(', ')}`);
    console.log('');
    
    process.exitCode = 1;
  } else {
    console.log('✅ All Portuguese tokens in sentences.json are covered by words.json');
    console.log('');
  }

  // Print unused words if any (optional warning)
  if (unusedWords.size > 0) {
    console.log('⚠️  Words in words.json not used in any sentence (by normalized form):');
    console.log('-'.repeat(60));
    const sortedUnused = Array.from(unusedWords).sort();
    // Show first 20, then count
    const displayCount = Math.min(20, sortedUnused.length);
    console.log(`   ${sortedUnused.slice(0, displayCount).join(', ')}`);
    if (sortedUnused.length > displayCount) {
      console.log(`   ... and ${sortedUnused.length - displayCount} more`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('Analysis complete!');
}

// Run the analysis
main();


/**
 * Script to generate synthetic word-level practice dataset.
 * 
 * Combines:
 * - Sentence text from sentences.json (via phrase_ids.csv matching)
 * - Word difficulty from words.json
 * - Azure pronunciation assessment data from phrase_*_JSON.json files
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SyntheticWordPracticeEntry } from '../src/types/wordPractice';

// Paths
const DATA_DIR = path.join(__dirname, '../data');
const TEST_DATA_DIR = path.join(__dirname, '../data/test_data');
const STATIC_DATA_DIR = path.join(__dirname, '../data/static');
const OUTPUT_FILE = path.join(__dirname, '../data/word_practice_synthetic.json');

// Load phrase_ids.csv to match phrase numbers to sentence text
interface PhraseIdEntry {
  phraseNumber: number;
  text: string;
  difficulty: number;
}

function loadPhraseIds(): PhraseIdEntry[] {
  const csvPath = path.join(TEST_DATA_DIR, 'phrase_ids.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  
  return lines.map((line, index) => {
    // CSV format: "text,difficulty" - split on last comma
    const lastCommaIndex = line.lastIndexOf(',');
    if (lastCommaIndex === -1) {
      throw new Error(`Invalid CSV line ${index + 1}: ${line}`);
    }
    const text = line.substring(0, lastCommaIndex).trim();
    const difficulty = parseInt(line.substring(lastCommaIndex + 1).trim(), 10);
    
    return {
      phraseNumber: index + 1,
      text,
      difficulty,
    };
  });
}

// Load sentences.json to get English translations
interface SentenceEntry {
  id: string;
  pt: string;
  en: string;
  difficulty: number;
}

function loadSentences(): SentenceEntry[] {
  // Try data/static first, then data folder
  const paths = [
    path.join(STATIC_DATA_DIR, 'sentences.json'),
    path.join(DATA_DIR, 'sentences.json'),
  ];
  
  let content: string | null = null;
  for (const filePath of paths) {
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
      break;
    }
  }
  
  if (!content) {
    throw new Error('sentences.json not found in data/static or data folder');
  }
  
  const data = JSON.parse(content);
  const sentences: SentenceEntry[] = [];
  
  if (data.categories && Array.isArray(data.categories)) {
    for (const category of data.categories) {
      if (category.sentences && Array.isArray(category.sentences)) {
        for (const sentence of category.sentences) {
          sentences.push({
            id: sentence.id,
            pt: sentence.pt,
            en: sentence.en,
            difficulty: sentence.difficulty,
          });
        }
      }
    }
  }
  
  return sentences;
}

// Load words.json to match words
interface WordEntry {
  id: string;
  pt: string;
  forms?: string[];
  en: string;
  difficulty: number;
}

function loadWords(): WordEntry[] {
  const paths = [
    path.join(STATIC_DATA_DIR, 'words.json'),
    path.join(DATA_DIR, 'words.json'),
  ];
  
  let content: string | null = null;
  for (const filePath of paths) {
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
      break;
    }
  }
  
  if (!content) {
    throw new Error('words.json not found in data/static or data folder');
  }
  
  const data = JSON.parse(content);
  const words: WordEntry[] = [];
  
  if (data.categories && Array.isArray(data.categories)) {
    for (const category of data.categories) {
      if (category.words && Array.isArray(category.words)) {
        for (const word of category.words) {
          words.push({
            id: word.id,
            pt: word.pt,
            forms: Array.isArray(word.forms) ? word.forms : undefined,
            en: word.en,
            difficulty: word.difficulty,
          });
        }
      }
    }
  }
  
  return words;
}

// Normalize word text for matching
function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[.,!?;:()"]/g, '') // Remove punctuation
    .trim();
}

// Build index of words by normalized text
function buildWordIndex(words: WordEntry[]): Map<string, WordEntry> {
  const index = new Map<string, WordEntry>();
  
  for (const word of words) {
    for (const variant of [word.pt, ...(word.forms || [])]) {
      const normalized = normalizeWord(variant);
      if (!normalized) {
        continue;
      }

      if (!index.has(normalized)) {
        index.set(normalized, word);
      }
    }
  }
  
  return index;
}

// Match sentence text to sentence entry (by normalized text)
function findMatchingSentence(
  phraseText: string,
  sentences: SentenceEntry[]
): SentenceEntry | null {
  const normalizedPhrase = normalizeWord(phraseText);
  
  for (const sentence of sentences) {
    const normalizedSentence = normalizeWord(sentence.pt);
    if (normalizedSentence === normalizedPhrase) {
      return sentence;
    }
  }
  
  return null;
}

// Load Azure JSON file
function loadAzureJson(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Azure JSON is an array with one element
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }
  
  return data;
}

// Extract phrase number from filename
function extractPhraseNumber(filename: string): number {
  const match = filename.match(/phrase_(\d+)_JSON\.json/);
  if (!match) {
    throw new Error(`Invalid Azure JSON filename: ${filename}`);
  }
  return parseInt(match[1], 10);
}

// Main generation function
function generateDataset(): SyntheticWordPracticeEntry[] {
  console.log('Loading data sources...');
  
  const phraseIds = loadPhraseIds();
  const sentences = loadSentences();
  const words = loadWords();
  const wordIndex = buildWordIndex(words);
  
  console.log(`Loaded ${phraseIds.length} phrases, ${sentences.length} sentences, ${words.length} words`);
  
  const dataset: SyntheticWordPracticeEntry[] = [];
  
  // Process each Azure JSON file
  const azureFiles = fs.readdirSync(TEST_DATA_DIR)
    .filter(f => f.startsWith('phrase_') && f.endsWith('_JSON.json'))
    .sort((a, b) => {
      const numA = extractPhraseNumber(a);
      const numB = extractPhraseNumber(b);
      return numA - numB;
    });
  
  console.log(`Found ${azureFiles.length} Azure JSON files`);
  
  for (const filename of azureFiles) {
    const phraseNumber = extractPhraseNumber(filename);
    const phraseId = `phrase_${phraseNumber}`;
    
    // Find matching phrase entry
    const phraseEntry = phraseIds.find(p => p.phraseNumber === phraseNumber);
    if (!phraseEntry) {
      console.warn(`No phrase entry found for phrase ${phraseNumber}`);
      continue;
    }
    
    // Find matching sentence
    const sentence = findMatchingSentence(phraseEntry.text, sentences);
    
    // Load Azure JSON
    const azureJsonPath = path.join(TEST_DATA_DIR, filename);
    const azureJson = loadAzureJson(azureJsonPath);
    
    const nBest = azureJson?.NBest?.[0];
    if (!nBest || !nBest.Words || !Array.isArray(nBest.Words)) {
      console.warn(`No word data found in ${filename}`);
      continue;
    }
    
    // Process each word
    for (let idx = 0; idx < nBest.Words.length; idx++) {
      const azureWord = nBest.Words[idx];
      const wordText = azureWord.Word || '';
      const normalizedWordText = normalizeWord(wordText);
      
      // Match to words.json
      const matchedWord = wordIndex.get(normalizedWordText);
      
      // Extract timing (Offset and Duration are in 100-nanosecond units)
      const offset = azureWord.Offset || 0;
      const duration = azureWord.Duration || 0;
      const startTimeMs = offset / 10000; // Convert to milliseconds
      const endTimeMs = startTimeMs + (duration / 10000);
      
      // Extract pronunciation assessment
      const pronunciationAssessment = azureWord.PronunciationAssessment || {};
      const accuracyScore = pronunciationAssessment.AccuracyScore;
      const errorType = pronunciationAssessment.ErrorType;
      
      // Create entry
      const entry: SyntheticWordPracticeEntry = {
        id: `${phraseId}-w${idx}`,
        phraseId,
        sentenceTextPt: phraseEntry.text,
        sentenceTextEn: sentence?.en,
        wordIndex: idx,
        wordText,
        normalizedWordText,
        wordsJsonId: matchedWord?.id,
        difficulty: matchedWord?.difficulty,
        startTimeMs: startTimeMs > 0 ? Math.round(startTimeMs) : undefined,
        endTimeMs: endTimeMs > 0 ? Math.round(endTimeMs) : undefined,
        overallScore: accuracyScore ? Math.round(accuracyScore) : undefined,
        accuracyScore: accuracyScore ? Math.round(accuracyScore) : undefined,
        errorType: errorType || undefined,
      };
      
      dataset.push(entry);
    }
    
    console.log(`Processed ${phraseId}: ${nBest.Words.length} words`);
  }
  
  return dataset;
}

// Main execution
function main() {
  try {
    console.log('Generating synthetic word-level practice dataset...\n');
    
    const dataset = generateDataset();
    
    console.log(`\nGenerated ${dataset.length} word entries`);
    
    // Write output
    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(dataset, null, 2),
      'utf-8'
    );
    
    console.log(`\nDataset written to: ${OUTPUT_FILE}`);
    console.log('\nSummary:');
    console.log(`- Total entries: ${dataset.length}`);
    console.log(`- Phrases processed: ${new Set(dataset.map(e => e.phraseId)).size}`);
    console.log(`- Entries with timing: ${dataset.filter(e => e.startTimeMs !== undefined).length}`);
    console.log(`- Entries with word match: ${dataset.filter(e => e.wordsJsonId).length}`);
    console.log(`- Entries with scores: ${dataset.filter(e => e.accuracyScore !== undefined).length}`);
    
  } catch (error) {
    console.error('Error generating dataset:', error);
    process.exit(1);
  }
}

main();

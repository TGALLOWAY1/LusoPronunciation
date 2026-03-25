#!/usr/bin/env node

/**
 * Normalizes Gemini-generated sentence CSV into the SentencesData schema
 * expected by the content generation pipeline.
 * 
 * This script:
 * 1. Reads the raw Gemini CSV output
 * 2. Creates stable IDs: gemini_<category>_<index>
 * 3. Maps categories to IDs
 * 4. Outputs data/sentences.json in the correct schema
 * 
 * Usage:
 *   npm run generate:normalize:sentences
 *   tsx scripts/normalizeGeminiSentences.ts --input data/raw/gemini_sentences.csv --output data/sentences.json
 */

import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import type { SentencesData, RawCategory, RawSentence } from '../src/lib/types';

/**
 * Maps Gemini category names to category IDs used in the app.
 */
const CATEGORY_MAP: Record<string, { id: string; labelEn: string; labelPt: string }> = {
  'Food & Eating': {
    id: 'food',
    labelEn: 'Food & Eating',
    labelPt: 'Comida e Refeições',
  },
  'Travel': {
    id: 'travel',
    labelEn: 'Travel',
    labelPt: 'Viagem',
  },
  'Family & Friends': {
    id: 'family_friends',
    labelEn: 'Family & Friends',
    labelPt: 'Família e Amigos',
  },
  'Daily Routine': {
    id: 'daily_routine',
    labelEn: 'Daily Routine',
    labelPt: 'Rotina Diária',
  },
  'Feelings & Emotions': {
    id: 'feelings',
    labelEn: 'Feelings & Emotions',
    labelPt: 'Sentimentos e Emoções',
  },
  'Questions & Asking for Help': {
    id: 'questions',
    labelEn: 'Questions & Asking for Help',
    labelPt: 'Perguntas e Pedir Ajuda',
  },
  'Shopping & Money': {
    id: 'shopping',
    labelEn: 'Shopping & Money',
    labelPt: 'Compras e Dinheiro',
  },
  'Directions & Transport': {
    id: 'directions',
    labelEn: 'Directions & Transport',
    labelPt: 'Direções e Transporte',
  },
  'Work & Study': {
    id: 'work_study',
    labelEn: 'Work & Study',
    labelPt: 'Trabalho e Estudo',
  },
  'Small Talk & Social': {
    id: 'small_talk',
    labelEn: 'Small Talk & Social',
    labelPt: 'Conversa e Social',
  },
};

/**
 * Parses command-line arguments.
 */
function parseArgs(): { input: string; output: string } {
  const args = process.argv.slice(2);
  
  let input = 'data/raw/gemini_sentences.csv';
  let output = 'data/sentences.json';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && i + 1 < args.length) {
      input = args[i + 1];
      i++;
    } else if (args[i] === '--output' && i + 1 < args.length) {
      output = args[i + 1];
      i++;
    }
  }
  
  return { input, output };
}

/**
 * Parses a CSV line, handling quoted fields with semicolons.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Infers difficulty level from sentence characteristics.
 * Simple heuristic: length and complexity indicators.
 */
function inferDifficulty(pt: string, en: string): 2 | 3 | 4 {
  const ptWords = pt.split(/\s+/).filter(w => w.length > 0).length;
  const enWords = en.split(/\s+/).filter(w => w.length > 0).length;
  const avgWords = (ptWords + enWords) / 2;

  // Check for complex features
  const hasComplexFeatures =
    pt.includes('?') || // Questions
    pt.includes(',') || // Multiple clauses
    pt.includes('que') || // Relative clauses
    pt.includes('quando') || // Temporal clauses
    pt.includes('porque') || // Causal clauses
    avgWords > 10; // Long sentences

  if (avgWords <= 6 && !hasComplexFeatures) {
    return 2; // Easy
  } else if (avgWords <= 8 || (avgWords <= 6 && hasComplexFeatures)) {
    return 3; // Medium
  } else {
    return 4; // Hard
  }
}

/**
 * Reads and parses the Gemini CSV file.
 */
async function readGeminiCSV(filePath: string): Promise<Array<{ pt: string; en: string; category: string }>> {
  const fileStream = createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  
  const sentences: Array<{ pt: string; en: string; category: string }> = [];
  let currentCategory: string | null = null;
  let categoryIndex = 0;
  let sentenceIndexInCategory = 0;
  let isFirstLine = true;
  
  for await (const line of rl) {
    // Skip header
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }
    
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }
    
    // Parse CSV line
    const parts = parseCSVLine(line);
    if (parts.length < 2) {
      continue;
    }
    
    const pt = parts[0].replace(/^"|"$/g, '').trim();
    const en = parts[1].replace(/^"|"$/g, '').trim();
    
    if (!pt || !en) {
      continue;
    }
    
    // Determine category based on sentence index
    // Gemini generates 50 sentences per category
    // We'll use the order to assign categories
    if (sentenceIndexInCategory === 0) {
      // New category - cycle through categories
      const categoryKeys = Object.keys(CATEGORY_MAP);
      currentCategory = categoryKeys[categoryIndex % categoryKeys.length];
      categoryIndex++;
    }
    
    sentences.push({
      pt,
      en,
      category: currentCategory || 'food', // Fallback
    });
    
    sentenceIndexInCategory++;
    if (sentenceIndexInCategory >= 50) {
      sentenceIndexInCategory = 0; // Reset for next category
    }
  }
  
  return sentences;
}

/**
 * Normalizes sentences into the SentencesData schema.
 */
async function normalizeSentences(
  inputPath: string,
  outputPath: string
): Promise<void> {
  console.log(`📥 Reading Gemini CSV from: ${inputPath}`);
  
  // Check if input file exists
  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file not found: ${inputPath}\n   Run 'npm run generate:gemini:sentences' first.`);
  }
  
  const rawSentences = await readGeminiCSV(inputPath);
  console.log(`   Loaded ${rawSentences.length} sentences from CSV\n`);
  
  // Group by category
  const categoryMap = new Map<string, RawSentence[]>();
  
  for (const raw of rawSentences) {
    const categoryInfo = CATEGORY_MAP[raw.category];
    if (!categoryInfo) {
      console.warn(`   ⚠️  Unknown category: ${raw.category}, using 'food' as fallback`);
      continue;
    }
    
    if (!categoryMap.has(categoryInfo.id)) {
      categoryMap.set(categoryInfo.id, []);
    }
    
    const categorySentences = categoryMap.get(categoryInfo.id)!;
    const index = categorySentences.length + 1;
    const id = `gemini_${categoryInfo.id}_${String(index).padStart(3, '0')}`;
    
    categorySentences.push({
      id,
      pt: raw.pt,
      en: raw.en,
      difficulty: inferDifficulty(raw.pt, raw.en),
      pronunciation_notes: undefined, // Gemini doesn't provide this
    });
  }
  
  // Build SentencesData structure
  const categories: RawCategory[] = [];
  for (const [categoryId, sentences] of categoryMap.entries()) {
    const categoryInfo = Object.values(CATEGORY_MAP).find(c => c.id === categoryId);
    if (categoryInfo) {
      categories.push({
        id: categoryId,
        label_en: categoryInfo.labelEn,
        label_pt: categoryInfo.labelPt,
        sentences,
      });
    }
  }
  
  const sentencesData: SentencesData = {
    language_pair: 'en-pt-BR',
    version: '1.0',
    categories,
  };
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });
  
  // Write output
  const jsonContent = JSON.stringify(sentencesData, null, 2);
  await fs.writeFile(outputPath, jsonContent, 'utf-8');
  
  console.log(`✅ Normalized ${rawSentences.length} sentences into ${categories.length} categories`);
  console.log(`📂 Wrote to: ${outputPath}\n`);
  
  // Print summary
  console.log('Category breakdown:');
  for (const category of categories) {
    console.log(`   ${category.id}: ${category.sentences?.length || 0} sentences`);
  }
}

/**
 * Main function.
 */
async function main(): Promise<void> {
  try {
    const { input, output } = parseArgs();
    await normalizeSentences(input, output);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { normalizeSentences };


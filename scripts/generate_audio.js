// TODO: This script will be replaced or wrapped by the new unified pipeline.
// See: src/pipeline/azureTTSClient.ts, src/pipeline/audioJobPlanner.ts, src/pipeline/runTTSJobs.ts

// Load .env file, but don't override existing environment variables
// This allows shell environment variables to take precedence
require("dotenv").config({ override: false });
const fs = require("fs");
const path = require("path");
const { synthesizeToFile, VOICES } = require("./azure_tts");

// Constants
const ROOT = path.join(__dirname, "..");
const SENTENCES_PATH = path.join(ROOT, "data", "sentences.json");
const AUDIO_INDEX_PATH = path.join(ROOT, "data", "audio_index.json");
const AUDIO_DIR = path.join(ROOT, "audio");

/**
 * Extract Portuguese text from a sentence with fallback logic
 */
function extractPortugueseText(sentence) {
  return (
    sentence.pt ||
    sentence.pt_br ||
    sentence.ptBr ||
    sentence.portuguese ||
    null
  );
}

/**
 * Derive stable audioId for a sentence
 */
function deriveAudioId(sentence, index) {
  if (sentence.audioId) {
    return sentence.audioId;
  }
  if (sentence.id) {
    return sentence.id;
  }
  // Generate: sentence_001, sentence_002, etc.
  return `sentence_${String(index + 1).padStart(3, "0")}`;
}

/**
 * Load sentences.json as an array
 */
function loadSentences() {
  if (!fs.existsSync(SENTENCES_PATH)) {
    throw new Error(`Sentences file not found: ${SENTENCES_PATH}`);
  }
  const content = fs.readFileSync(SENTENCES_PATH, "utf-8");
  const data = JSON.parse(content);

  // Flatten categories into a single array
  const sentences = [];
  if (Array.isArray(data)) {
    return data;
  }
  if (data.categories && Array.isArray(data.categories)) {
    for (const category of data.categories) {
      if (category.sentences && Array.isArray(category.sentences)) {
        sentences.push(...category.sentences);
      }
    }
  } else if (data.sentences && Array.isArray(data.sentences)) {
    return data.sentences;
  }
  return sentences;
}

/**
 * Load existing audio_index.json or return empty object
 */
function loadAudioIndex() {
  if (fs.existsSync(AUDIO_INDEX_PATH)) {
    const content = fs.readFileSync(AUDIO_INDEX_PATH, "utf-8");
    return JSON.parse(content);
  }
  return {};
}

/**
 * Save audio_index.json
 */
function saveAudioIndex(index) {
  // Ensure data directory exists
  const dataDir = path.dirname(AUDIO_INDEX_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(
    AUDIO_INDEX_PATH,
    JSON.stringify(index, null, 2),
    "utf-8"
  );
}

/**
 * Main function
 */
(async function main() {
  try {
    console.log("Starting audio generation for LusoPronounce...\n");

    // --- Azure Speech Configuration Debug Info ---
    console.log("============================================");
    console.log(" Azure Speech Configuration ");
    console.log("============================================");
    console.log("Region:      ", process.env.AZURE_SPEECH_REGION || "(missing)");
    console.log(
      "Key (prefix):",
      process.env.AZURE_SPEECH_KEY
        ? process.env.AZURE_SPEECH_KEY.slice(0, 5) + "*****"
        : "(missing)"
    );
    console.log("Voices:");
    for (const [gender, voiceName] of Object.entries(VOICES)) {
      console.log(`  - ${gender}: ${voiceName}`);
    }
    console.log("============================================\n");

    // Check Azure credentials
    if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
      console.error(
        "ERROR: Missing Azure Speech credentials.\n" +
          "Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables."
      );
      process.exit(1);
    }

    // Load sentences
    console.log(`Loading sentences from: ${SENTENCES_PATH}`);
    const sentences = loadSentences();
    console.log(`Found ${sentences.length} sentences\n`);

    // Load existing audio index
    const audioIndex = loadAudioIndex();

    // Process each sentence
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const audioId = deriveAudioId(sentence, i);
      const textPt = extractPortugueseText(sentence);

      // Skip if no Portuguese text
      if (!textPt || textPt.trim() === "") {
        console.warn(
          `⚠️  Skipping sentence ${i + 1} (id: ${sentence.id || "unknown"}): No Portuguese text found`
        );
        continue;
      }

      console.log(`[${i + 1}/${sentences.length}] Processing: ${audioId}`);
      console.log(`  Text: ${textPt}`);

      // Ensure entry exists in audio index
      if (!audioIndex[audioId]) {
        audioIndex[audioId] = {
          type: "sentence",
          sourceId: sentence.id || null,
          textPt: textPt,
          textEn: sentence.en || sentence.en_us || sentence.english || null,
          ptbr: {
            male: null,
            female: null,
          },
        };
      } else {
        // Update text if missing
        if (!audioIndex[audioId].textPt) {
          audioIndex[audioId].textPt = textPt;
        }
        if (!audioIndex[audioId].textEn && (sentence.en || sentence.en_us || sentence.english)) {
          audioIndex[audioId].textEn = sentence.en || sentence.en_us || sentence.english;
        }
      }

      // Process each gender
      for (const [gender, voiceName] of Object.entries(VOICES)) {
        // Compute relative path (POSIX separators)
        const relativePath = `audio/ptbr/${gender}/${audioId}.wav`;
        // Compute absolute path
        const absolutePath = path.join(ROOT, relativePath);

        // Check if file already exists
        if (fs.existsSync(absolutePath)) {
          console.log(`  ⊘ Skipped ${gender} (file exists)`);
          audioIndex[audioId].ptbr[gender] = relativePath;
          skippedCount++;
        } else {
          try {
            // Generate audio
            await synthesizeToFile({
              text: textPt,
              voiceName: voiceName,
              outputPath: absolutePath,
            });
            audioIndex[audioId].ptbr[gender] = relativePath;
            processedCount++;
          } catch (error) {
            console.error(`  ✗ Error generating ${gender} audio: ${error.message}`);
            errorCount++;
            // Continue with other gender
          }
        }
      }

      // Write audio index after each sentence (progress is never lost)
      saveAudioIndex(audioIndex);
    }

    // Final summary
    console.log("\n" + "=".repeat(50));
    console.log("Summary:");
    console.log(`  Sentences processed: ${sentences.length}`);
    console.log(`  Audio files generated: ${processedCount}`);
    console.log(`  Audio files skipped (existing): ${skippedCount}`);
    if (errorCount > 0) {
      console.log(`  Errors: ${errorCount}`);
    }
    console.log(`  Audio index: ${AUDIO_INDEX_PATH}`);
    console.log("=".repeat(50));

    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
})().catch((error) => {
  console.error("\n❌ Unhandled error:", error);
  process.exit(1);
});

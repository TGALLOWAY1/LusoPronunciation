# Audio Generation Scripts

This directory contains scripts for generating audio files using Azure Text-to-Speech.

## Prerequisites

1. **Azure Speech Service**: You need an Azure Speech resource with a subscription key and region.

2. **Environment Variables**: Set the following before running the script:
   ```bash
   export AZURE_SPEECH_KEY="your-azure-speech-key"
   export AZURE_SPEECH_REGION="your-azure-region"  # e.g., "eastus", "westus2"
   ```

3. **Dependencies**: Install Node.js dependencies:
   ```bash
   npm install
   ```

## Usage

Generate audio files for all sentences and words:

```bash
npm run generate-audio
```

Or run directly:

```bash
node scripts/generate_audio.js
```

## What It Does

1. **Reads Data**: Loads `data/static/sentences.json` and `data/static/words.json`

2. **Generates Audio**: For each sentence and word:
   - Creates male voice audio (pt-BR-AntonioNeural)
   - Creates female voice audio (pt-BR-FranciscaNeural)
   - Saves as WAV files in `audio/ptbr/male/` and `audio/ptbr/female/`

3. **Creates Index**: Generates/updates `data/audio_index.json` mapping audioIds to file paths

4. **Skips Existing**: If an audio file already exists, it skips generation (safe to re-run)

## Output Structure

```
audio/
  ptbr/
    male/
      sentence_001.wav
      sentence_002.wav
      word_001.wav
      ...
    female/
      sentence_001.wav
      sentence_002.wav
      word_001.wav
      ...

data/
  audio_index.json  # Maps audioIds to file paths
```

## Audio Index Format

The `audio_index.json` file has this structure:

```json
{
  "sentence_001": {
    "audioId": "sentence_001",
    "ptbr": {
      "male": "audio/ptbr/male/sentence_001.wav",
      "female": "audio/ptbr/female/sentence_001.wav"
    }
  },
  "word_001": {
    "audioId": "word_001",
    "ptbr": {
      "male": "audio/ptbr/male/word_001.wav",
      "female": "audio/ptbr/female/word_001.wav"
    }
  }
}
```

## Notes

- Audio files are generated at 44.1kHz WAV format
- The script is idempotent: safe to run multiple times
- Only PT-BR (Brazilian Portuguese) audio is generated
- Audio IDs are normalized to `sentence_XXX` or `word_XXX` format


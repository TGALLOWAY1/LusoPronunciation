// Load .env file, but don't override existing environment variables
// This allows shell environment variables to take precedence
require("dotenv").config({ override: false });
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");
const path = require("path");

const VOICES = {
  male: "pt-BR-AntonioNeural",
  female: "pt-BR-FranciscaNeural",
};

/**
 * Synthesizes text to speech using Azure TTS and saves to a file.
 * @param {Object} params
 * @param {string} params.text - The text to synthesize (PT-BR)
 * @param {string} params.voiceName - Azure voice name (e.g., "pt-BR-AntonioNeural")
 * @param {string} params.outputPath - Full path where the WAV file should be saved
 * @returns {Promise<string>} Resolves with outputPath on success
 */
function synthesizeToFile({ text, voiceName, outputPath }) {
  // Read from environment variables (from shell or .env file)
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    throw new Error(
      "Missing Azure Speech credentials. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables."
    );
  }

  // Ensure target directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create speech config
  const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
  speechConfig.speechSynthesisVoiceName = voiceName;

  // Create audio config for WAV file output
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputPath);

  // Create synthesizer
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

  return new Promise((resolve, reject) => {
    synthesizer.speakTextAsync(
      text,
      (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          console.log(`✔ Synthesized "${text.slice(0, 40)}..." → ${outputPath}`);
          synthesizer.close();
          resolve(outputPath);
        } else {
          const err =
            result.errorDetails ||
            `Speech synthesis failed with reason: ${result.reason}`;
          console.error("✖ Synthesis error:", err);
          synthesizer.close();
          reject(new Error(err));
        }
      },
      (error) => {
        console.error("✖ Synthesis exception:", error);
        synthesizer.close();
        reject(error);
      }
    );
  });
}

module.exports = { synthesizeToFile, VOICES };

#!/usr/bin/env node

import { assessPronunciation } from '../../src/pipeline/azurePronunciationClient';

async function main() {
  const liveMode = process.env.AZURE_SMOKE_MODE === 'live';

  if (!liveMode) {
    console.log('[azureSmokeTest] Mock mode enabled. Set AZURE_SMOKE_MODE=live to run live Azure checks.');
    console.log('[azureSmokeTest] PASS (mock)');
    return;
  }

  const sampleTexts = [
    'Bom dia.',
    'Eu gostaria de um café.',
    'Onde fica o aeroporto?',
  ];

  for (const text of sampleTexts) {
    const result = await assessPronunciation({
      text,
      locale: 'pt-BR',
    });
    const root = Array.isArray(result) ? result[0] : result;
    const status = root?.RecognitionStatus ?? 'Unknown';
    if (status !== 'Success') {
      throw new Error(`Azure smoke test failed for "${text}" with status ${status}`);
    }
  }

  console.log('[azureSmokeTest] PASS (live)');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[azureSmokeTest] ${message}`);
  process.exit(1);
});


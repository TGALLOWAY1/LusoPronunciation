/**
 * Azure AI Translator client for English → Brazilian Portuguese.
 *
 * Wraps the Translator REST endpoint:
 *   POST {endpoint}/translate?api-version=3.0&from=en&to=pt-BR
 *
 * Required env vars:
 *   - AZURE_TRANSLATOR_KEY      subscription key
 *   - AZURE_TRANSLATOR_REGION   e.g. "eastus" (sent as Ocp-Apim-Subscription-Region)
 *   - AZURE_TRANSLATOR_ENDPOINT optional; defaults to the global endpoint
 *
 * The service is pure and stateless: it reads env on every call so tests can
 * mutate process.env without re-importing. Network I/O goes through the
 * global `fetch` (Node 18+) so tests can stub it via vi.stubGlobal.
 */

import type { TranslationResult } from '../../shared/types/customSentence';

const DEFAULT_ENDPOINT = 'https://api.cognitive.microsofttranslator.com';
const TRANSLATOR_PATH = '/translate';
const API_VERSION = '3.0';

const LOG_TAG = '[Translation]';

export class TranslationError extends Error {
  readonly status?: number;
  readonly cause?: unknown;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'TranslationError';
    this.status = options.status;
    this.cause = options.cause;
  }
}

interface AzureTranslatorItem {
  translations: Array<{
    text: string;
    to: string;
    confidence?: number;
  }>;
  detectedLanguage?: {
    language: string;
    score?: number;
  };
}

interface TranslationOptions {
  from?: string;
  to?: string;
  signal?: AbortSignal;
}

/**
 * Translates an English sentence into Brazilian Portuguese via Azure Translator.
 *
 * Returns the translated text plus provider metadata (confidence defaults to
 * 1 because Azure Translator doesn't return a confidence score for explicit
 * source languages; kept in the shape so alternative providers can fill it).
 */
export async function translateEnglishToPortuguese(
  text: string,
  options: TranslationOptions = {}
): Promise<TranslationResult> {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new TranslationError('Translation input is empty');
  }

  const { key, region, endpoint } = readTranslatorConfig();
  const from = options.from ?? 'en';
  const to = options.to ?? 'pt-BR';

  const url = new URL(TRANSLATOR_PATH, endpoint);
  url.searchParams.set('api-version', API_VERSION);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  console.log(`${LOG_TAG} translating ${trimmed.length} chars (${from} → ${to})`);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ Text: trimmed }]),
      signal: options.signal,
    });
  } catch (err) {
    throw new TranslationError('Azure Translator request failed', { cause: err });
  }

  if (!response.ok) {
    const body = await safeReadBody(response);
    console.error(`${LOG_TAG} Azure Translator error ${response.status}: ${body}`);
    throw new TranslationError(
      `Azure Translator returned ${response.status}`,
      { status: response.status }
    );
  }

  const payload = (await response.json()) as AzureTranslatorItem[] | unknown;
  const result = parseTranslationResponse(payload, to);
  console.log(
    `${LOG_TAG} translated ${trimmed.length} → ${result.textPt.length} chars (provider=azure_translator)`
  );
  return result;
}

function parseTranslationResponse(
  payload: unknown,
  expectedTo: string
): TranslationResult {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new TranslationError('Azure Translator returned an empty payload');
  }

  const first = payload[0] as AzureTranslatorItem;
  const translation = first?.translations?.find((t) => t.to === expectedTo)
    ?? first?.translations?.[0];

  if (!translation || typeof translation.text !== 'string') {
    throw new TranslationError('Azure Translator response missing translated text');
  }

  return {
    textPt: translation.text,
    provider: 'azure_translator',
    confidence: typeof translation.confidence === 'number' ? translation.confidence : 1,
    detectedSourceLanguage: first.detectedLanguage?.language,
  };
}

function readTranslatorConfig(): { key: string; region: string; endpoint: string } {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT?.trim() || DEFAULT_ENDPOINT;

  if (!key || !region) {
    throw new TranslationError(
      'Missing Azure Translator credentials. Set AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION.'
    );
  }

  return { key, region, endpoint };
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '<unreadable body>';
  }
}

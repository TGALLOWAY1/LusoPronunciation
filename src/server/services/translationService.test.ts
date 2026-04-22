import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  translateEnglishToPortuguese,
  TranslationError,
} from './translationService';

const ORIGINAL_ENV = { ...process.env };

function setEnv() {
  process.env.AZURE_TRANSLATOR_KEY = 'test-key';
  process.env.AZURE_TRANSLATOR_REGION = 'eastus';
  delete process.env.AZURE_TRANSLATOR_ENDPOINT;
}

describe('translateEnglishToPortuguese', () => {
  beforeEach(() => {
    setEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('sends a POST to Azure Translator and parses the translated text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            detectedLanguage: { language: 'en', score: 1 },
            translations: [{ text: 'Eu preciso comprar pão', to: 'pt-BR' }],
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await translateEnglishToPortuguese('I need to buy bread');

    expect(result).toEqual({
      textPt: 'Eu preciso comprar pão',
      provider: 'azure_translator',
      confidence: 1,
      detectedSourceLanguage: 'en',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/translate');
    expect(String(url)).toContain('from=en');
    expect(String(url)).toContain('to=pt-BR');
    expect(init.headers['Ocp-Apim-Subscription-Key']).toBe('test-key');
    expect(init.headers['Ocp-Apim-Subscription-Region']).toBe('eastus');
    expect(JSON.parse(init.body as string)).toEqual([{ Text: 'I need to buy bread' }]);
  });

  it('throws TranslationError when input is empty', async () => {
    await expect(translateEnglishToPortuguese('   ')).rejects.toBeInstanceOf(
      TranslationError
    );
  });

  it('throws TranslationError when credentials are missing', async () => {
    delete process.env.AZURE_TRANSLATOR_KEY;
    await expect(translateEnglishToPortuguese('hello')).rejects.toThrow(
      /AZURE_TRANSLATOR_KEY/
    );
  });

  it('throws TranslationError on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('quota exceeded', { status: 429 })
      )
    );

    await expect(translateEnglishToPortuguese('hello')).rejects.toMatchObject({
      name: 'TranslationError',
      status: 429,
    });
  });

  it('throws TranslationError on empty translations array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ translations: [] }]), { status: 200 })
      )
    );

    await expect(translateEnglishToPortuguese('hello')).rejects.toBeInstanceOf(
      TranslationError
    );
  });
});

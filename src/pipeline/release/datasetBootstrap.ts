import { CONTENT_SOURCE, REQUIRE_DATASET_BOOTSTRAP, getReleaseDataPath } from '@/config/appConfig';

interface ManifestArtifact {
  path: string;
  count: number;
  sha256: string;
}

interface DatasetManifest {
  datasetVersion: string;
  schemaVersion: string;
  locale: 'pt-BR';
  artifacts: Record<string, ManifestArtifact>;
}

let bootstrapPromise: Promise<void> | null = null;

const REQUIRED_ARTIFACT_KEYS = ['words', 'sentences', 'audioIndex', 'categories'];

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', input);
  return toHex(digest);
}

async function fetchJsonOrThrow<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function validateManifestShape(manifest: DatasetManifest): void {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Dataset manifest is missing or invalid.');
  }

  if (manifest.locale !== 'pt-BR') {
    throw new Error(`Dataset locale must be pt-BR, received "${manifest.locale}".`);
  }

  for (const key of REQUIRED_ARTIFACT_KEYS) {
    const artifact = manifest.artifacts?.[key];
    if (!artifact || typeof artifact.path !== 'string' || !artifact.sha256 || typeof artifact.count !== 'number') {
      throw new Error(`Manifest artifact "${key}" is missing required fields.`);
    }
  }
}

async function verifyArtifactChecksum(baseUrl: string, artifact: ManifestArtifact): Promise<void> {
  const artifactUrl = `${baseUrl}/${artifact.path.replace(/^\/+/, '')}`;
  const response = await fetch(artifactUrl);
  if (!response.ok) {
    throw new Error(`Missing artifact ${artifact.path}: ${response.status} ${response.statusText}`);
  }

  const body = await response.arrayBuffer();
  const actualSha = await sha256Hex(body);
  const expectedSha = artifact.sha256.replace(/^sha256:/, '');
  if (actualSha !== expectedSha) {
    throw new Error(`Checksum mismatch for ${artifact.path}. Expected ${expectedSha}, got ${actualSha}.`);
  }
}

async function runBootstrapValidation(): Promise<void> {
  const manifestPath = getReleaseDataPath('dataset-manifest.json');
  const manifest = await fetchJsonOrThrow<DatasetManifest>(manifestPath);
  validateManifestShape(manifest);

  const baseUrl = manifestPath.replace(/\/dataset-manifest\.json$/, '');
  for (const key of REQUIRED_ARTIFACT_KEYS) {
    await verifyArtifactChecksum(baseUrl, manifest.artifacts[key]);
  }
}

export async function ensureDatasetBootstrap(): Promise<void> {
  if (CONTENT_SOURCE !== 'pipeline') {
    return;
  }

  if (!REQUIRE_DATASET_BOOTSTRAP) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrapValidation();
  }

  return bootstrapPromise;
}


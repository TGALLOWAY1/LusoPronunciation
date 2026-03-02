export const ERROR_CLASS = {
  clientMicDenied: 'client_mic_denied',
  clientQualityGate: 'client_quality_gate',
  clientAbort: 'client_abort',
  networkError: 'network_error',
  serverRateLimited: 'server_rate_limited',
  serverPayloadTooLarge: 'server_payload_too_large',
  serverConvertFailed: 'server_convert_failed',
  serverConvertTimeout: 'server_convert_timeout',
  azure4xx: 'azure_4xx',
  azure5xx: 'azure_5xx',
  serverUnknown: 'server_unknown',
} as const;

export type ErrorClass = (typeof ERROR_CLASS)[keyof typeof ERROR_CLASS];

export const ERROR_CLASS_LIST: readonly ErrorClass[] = Object.freeze(
  Object.values(ERROR_CLASS)
);

export function isErrorClass(value: unknown): value is ErrorClass {
  return typeof value === 'string' && ERROR_CLASS_LIST.includes(value as ErrorClass);
}

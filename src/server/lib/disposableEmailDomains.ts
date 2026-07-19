/**
 * Best-effort disposable / throwaway email domain blocklist.
 *
 * This is intentionally a small, hand-curated static list of the most common
 * temporary-inbox providers — NOT an exhaustive or authoritative source. Its
 * purpose is to add a little friction against low-effort bot signups that lean
 * on well-known throwaway services, in combination with the honeypot field and
 * the per-IP registration rate limit. Determined abusers can trivially register
 * new domains or use less-common providers, so do not treat this as a security
 * boundary — the persistent assessment quota is the real Azure-billing control.
 *
 * Keep it short and obvious. If a legitimate user reports being blocked, remove
 * the offending domain here.
 */
const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'getnada.com',
  'trashmail.com',
  'sharklasers.com',
  'dispostable.com',
  'maildrop.cc',
  'mailnesia.com',
  'fakeinbox.com',
  'mohmal.com',
  'emailondeck.com',
  'moakt.com',
  'tempmailo.com',
  'mintemail.com',
]);

/**
 * Returns true if the email's domain is on the best-effort disposable list.
 * Comparison is case-insensitive. Malformed input returns false (the caller's
 * email-format validation is responsible for rejecting non-emails).
 */
export function isDisposableEmailDomain(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at === -1 || at === email.length - 1) {
    return false;
  }
  const domain = email.slice(at + 1).trim().toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

export const DISPOSABLE_EMAIL_DOMAIN_COUNT = DISPOSABLE_EMAIL_DOMAINS.size;

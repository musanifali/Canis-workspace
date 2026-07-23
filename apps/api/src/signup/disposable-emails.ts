/**
 * Disposable / throwaway email domains rejected at signup (#91 AC). A small
 * curated set of the highest-volume providers — this is an abuse speed-bump,
 * not an exhaustive blocklist (that would be a service + a subscription). The
 * GitHub OAuth requirement is the real identity gate; this stops the laziest
 * throwaway-tenant scripting.
 */
const DISPOSABLE_DOMAINS = new Set<string>([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "grr.la",
  "sharklasers.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "getnada.com",
  "dispostable.com",
  "trashmail.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnesia.com",
  "mohmal.com",
  "spam4.me",
]);

/**
 * @returns true when the address's domain is a known disposable provider.
 *   Non-string / malformed input returns false — validation happens upstream.
 */
export function isDisposableEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return DISPOSABLE_DOMAINS.has(domain);
}

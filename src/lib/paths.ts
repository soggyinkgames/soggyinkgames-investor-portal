/**
 * Guards against open-redirect vulnerabilities by only allowing
 * relative paths (starting with '/') through as a redirect target.
 */
export function safePortalRedirect(next: string | null, fallback = '/dashboard') {
  if (!next?.startsWith('/')) {
    return fallback;
  }
  return next;
}
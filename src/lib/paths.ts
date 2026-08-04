export const PORTAL_PREFIX = '/investors';
export const PORTAL_ORIGIN = 'https://soggyinkgames.com';

/**
 * Detects if the current runtime is on the investor subdomain.
 */
export function isSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('investors.');
}

export function stripPortalPrefix(pathname: string) {
  if (pathname === PORTAL_PREFIX) {
    return '/';
  }

  if (pathname.startsWith(`${PORTAL_PREFIX}/`)) {
    return pathname.slice(PORTAL_PREFIX.length) || '/';
  }

  return pathname || '/';
}

export function withPortalPrefix(pathname: string) {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

  // If on subdomain, strip /investors prefix completely
  if (isSubdomain()) {
    return stripPortalPrefix(normalized);
  }

  // Original prefix logic for main domain
  if (normalized === PORTAL_PREFIX || normalized.startsWith(`${PORTAL_PREFIX}/`)) {
    return normalized;
  }

  return `${PORTAL_PREFIX}${normalized === '/' ? '/' : normalized}`;
}

export function portalUrl(pathname: string) {
  // Uses active window origin on client, falls back to PORTAL_ORIGIN on server
  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : PORTAL_ORIGIN;
  return new URL(withPortalPrefix(pathname), baseOrigin).toString();
}

export function safePortalRedirect(next: string | null, fallback = '/dashboard') {
  if (!next?.startsWith('/')) {
    return withPortalPrefix(fallback);
  }

  const pathname = stripPortalPrefix(next);
  return withPortalPrefix(pathname);
}
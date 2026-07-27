export const PORTAL_PREFIX = '/investors';
export const PORTAL_ORIGIN = 'https://soggyinkgames.com';

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

  if (normalized === PORTAL_PREFIX || normalized.startsWith(`${PORTAL_PREFIX}/`)) {
    return normalized;
  }

  return `${PORTAL_PREFIX}${normalized === '/' ? '/' : normalized}`;
}

export function portalUrl(pathname: string) {
  return new URL(withPortalPrefix(pathname), PORTAL_ORIGIN).toString();
}

export function safePortalRedirect(next: string | null, fallback = '/dashboard') {
  if (!next?.startsWith('/')) {
    return withPortalPrefix(fallback);
  }

  const pathname = stripPortalPrefix(next);
  return withPortalPrefix(pathname);
}

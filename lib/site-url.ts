const PRODUCTION_URL = 'https://www.redfoxcrm.com';

// Origins whose paths we accept in a `next` value. We only ever keep the path,
// never redirect to these origins directly.
const KNOWN_ORIGINS = new Set([
  'https://www.redfoxcrm.com',
  'https://redfoxcrm.com',
  'http://www.redfoxcrm.com',
  'http://redfoxcrm.com',
]);

function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (isLocalHost(url.hostname)) return url.origin;
    // Never email plain-http links or the SSO-protected *.vercel.app host.
    if (url.protocol !== 'https:') return null;
    const vercelEnv = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
    if (vercelEnv === 'production' && url.hostname.endsWith('.vercel.app')) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Public base URL for links that leave the app (auth emails, redirects).
 * NEXT_PUBLIC_SITE_URL ?? NEXT_PUBLIC_APP_URL ?? https://www.redfoxcrm.com.
 * Pass the current origin from the browser so local development keeps working.
 */
export function getSiteUrl(currentOrigin?: string): string {
  if (currentOrigin) {
    try {
      if (isLocalHost(new URL(currentOrigin).hostname)) return new URL(currentOrigin).origin;
    } catch {
      // ignore and fall through to env/production
    }
  }
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    PRODUCTION_URL
  );
}

/**
 * Turns an untrusted `next` value (relative path or absolute URL on one of our
 * own origins) into a same-origin path. Anything else returns `fallback`.
 * Nested /auth/confirm?next=… or /auth/callback?next=… values are unwrapped so
 * the email template can pass {{ .RedirectTo }} through unchanged.
 */
export function resolveSafeNext(raw: string | null | undefined, requestOrigin: string, fallback: string): string {
  let value = raw?.trim();
  for (let depth = 0; depth < 3 && value; depth++) {
    // Only absolute http(s) URLs or root-relative paths; "undefined/…" and
    // other relative strings are rejected.
    if (!value.startsWith('/') && !/^https?:\/\//i.test(value)) return fallback;
    let url: URL;
    try {
      url = new URL(value, requestOrigin);
    } catch {
      return fallback;
    }
    const trusted =
      url.origin === requestOrigin || url.origin === getSiteUrl() || KNOWN_ORIGINS.has(url.origin);
    if (!trusted) return fallback;

    if (url.pathname === '/auth/confirm' || url.pathname === '/auth/callback') {
      value = url.searchParams.get('next') ?? undefined;
      continue;
    }

    const path = `${url.pathname}${url.search}`;
    // URL parsing treats "\" as "/". Reject anything that would leave this origin
    // once the browser or Next follows the redirect (/\evil.com, %2F%2Fevil.com).
    if (!isSameOriginPath(path, requestOrigin)) return fallback;
    return path === '/' ? fallback : path;
  }
  return fallback;
}

function isSameOriginPath(path: string, requestOrigin: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false;
  let origin: string;
  try {
    origin = new URL(requestOrigin).origin;
  } catch {
    return false;
  }
  let rebuilt: URL;
  try {
    rebuilt = new URL(path, origin);
  } catch {
    return false;
  }
  if (rebuilt.origin !== origin) return false;
  let decoded = rebuilt.pathname;
  try {
    decoded = decodeURIComponent(rebuilt.pathname);
  } catch {
    return false;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) return false;
  if (/[\u0000-\u001F]/.test(decoded)) return false;
  return true;
}

/** Error-page copy: invite links should not offer a password reset. */
export function authErrorType(next: string, explicit?: string | null): 'invite' | 'recovery' | null {
  if (explicit === 'invite' || explicit === 'recovery') return explicit;
  if (isPath(next, '/update-password')) return 'recovery';
  if (isPath(next, '/auth/set-password')) return 'invite';
  return null;
}

function isPath(value: string, path: string) {
  return value === path || value.startsWith(`${path}?`) || value.startsWith(`${path}/`);
}

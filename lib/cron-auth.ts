/**
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
 * Fail closed when the secret is missing — otherwise the check becomes
 * `Bearer undefined` and a request that sends that literal string would pass.
 */
export function isCronAuthorized(
  authorizationHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  return authorizationHeader === `Bearer ${secret}`;
}

'use server'

import { headers } from 'next/headers'
import {
  getSiteUrl,
  guardPreviewEmailOrigin,
  isPreviewDeployment,
  previewOrigin,
} from '@/lib/site-url'

function headerHost(value: string | null) {
  return value?.split(',')[0]?.trim() ?? ''
}

/**
 * Origin for auth emails. On a preview, uses this request's host (https),
 * then VERCEL_BRANCH_URL, then VERCEL_URL. Production stays on
 * https://www.redfoxcrm.com and never uses *.vercel.app.
 * Pass window.location.origin from the browser; the request host wins when
 * it is a preview host.
 */
export async function getRequestSiteUrl(requestOrigin?: string): Promise<string> {
  const headerList = await headers()
  const host = headerHost(headerList.get('x-forwarded-host') ?? headerList.get('host'))
  const hostname = host.split(':')[0]?.toLowerCase() ?? ''
  const forwardedProto = headerList.get('x-forwarded-proto')

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${forwardedProto ?? 'http'}://${host}`
  }

  if (isPreviewDeployment()) {
    const fromHeaders = host ? previewOrigin(`https://${host}`) : null
    if (fromHeaders) return fromHeaders
    const fromCaller = previewOrigin(requestOrigin)
    if (fromCaller) return fromCaller
    return previewOrigin(process.env.VERCEL_BRANCH_URL) ?? previewOrigin(process.env.VERCEL_URL) ?? ''
  }

  return getSiteUrl()
}

export async function authEmailRedirect(
  nextPath: string,
  requestOrigin?: string,
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const origin = await getRequestSiteUrl(requestOrigin)
  const guard = guardPreviewEmailOrigin(origin)
  if (!guard.ok) return guard
  return {
    ok: true,
    redirectTo: `${guard.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
  }
}

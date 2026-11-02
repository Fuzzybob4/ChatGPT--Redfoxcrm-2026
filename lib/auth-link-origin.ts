'use server'

import { headers } from 'next/headers'
import { getSiteUrl } from '@/lib/site-url'

function hostnameOf(host: string) {
  return host.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? ''
}

function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function isVercelPreviewHost(hostname: string) {
  return hostname.endsWith('.vercel.app')
}

/**
 * Origin embedded in auth emails.
 * Production stays on https://www.redfoxcrm.com.
 * Preview uses the host the browser called, then VERCEL_BRANCH_URL.
 */
export async function getAuthLinkOrigin(): Promise<string> {
  const headerList = await headers()
  const host = (headerList.get('x-forwarded-host') ?? headerList.get('host') ?? '').split(',')[0]?.trim() ?? ''
  const hostname = hostnameOf(host)

  if (isLocalHost(hostname)) {
    const proto = headerList.get('x-forwarded-proto') ?? 'http'
    return `${proto}://${host}`
  }

  if (process.env.VERCEL_ENV === 'preview') {
    if (host && isVercelPreviewHost(hostname)) return `https://${host}`
    const branch = process.env.VERCEL_BRANCH_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (branch) return `https://${branch}`
  }

  return getSiteUrl()
}

export async function authConfirmRedirect(nextPath: string): Promise<string> {
  const origin = await getAuthLinkOrigin()
  return `${origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`
}

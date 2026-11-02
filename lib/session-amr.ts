/** Methods on the access token, or null when the JWT does not expose `amr`. */
export function amrMethods(accessToken: string | undefined): string[] | null {
  if (!accessToken) return null
  const part = accessToken.split('.')[1]
  if (!part) return null
  try {
    const json = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { amr?: unknown }
    if (!('amr' in json)) return null
    if (!Array.isArray(json.amr)) return null
    return json.amr
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry && typeof entry === 'object' && 'method' in entry) {
          const method = (entry as { method?: unknown }).method
          return typeof method === 'string' ? method : ''
        }
        return ''
      })
      .filter(Boolean)
  } catch {
    return null
  }
}

const RECOVERY_METHODS = ['recovery', 'otp']
const INVITE_METHODS = ['recovery', 'otp', 'invite']

/** When `amr` is missing, the caller just verified a link and the cookie is the check. */
export function amrAllows(methods: string[] | null, kind: 'recovery' | 'invite'): boolean {
  if (methods === null) return true
  const allowed = kind === 'recovery' ? RECOVERY_METHODS : INVITE_METHODS
  return methods.some((method) => allowed.includes(method))
}

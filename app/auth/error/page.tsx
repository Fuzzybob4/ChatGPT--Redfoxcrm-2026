import Link from 'next/link'

interface Props {
  searchParams: Promise<{ reason?: string; type?: string }>
}

type LinkKind = 'signup' | 'invite' | 'recovery'

const COPY: Record<LinkKind, { title: Record<string, string>; step: string; href: string; action: string }> = {
  signup: {
    title: {
      expired: 'This confirmation link has expired or was already used',
      other_browser: 'Open the confirmation link in the same browser',
      invalid: "This confirmation link isn't valid",
    },
    step: 'Send yourself a new confirmation email from the signup page.',
    href: '/signup',
    action: 'Resend confirmation email',
  },
  invite: {
    title: {
      expired: 'This invite link has expired or was already used',
      other_browser: 'Open the invite link in the same browser',
      invalid: "This invite link isn't valid",
    },
    step: 'Ask your admin to send a new invite.',
    href: '/login',
    action: 'Go to sign in',
  },
  recovery: {
    title: {
      expired: 'This reset link has expired or was already used',
      other_browser: 'Open the reset link in the same browser',
      invalid: "This reset link isn't valid",
    },
    step: 'You can request a new password reset link.',
    href: '/forgot-password',
    action: 'Send a new reset link',
  },
}

function kindOf(type?: string): LinkKind | null {
  if (type === 'signup' || type === 'email') return 'signup'
  if (type === 'invite') return 'invite'
  if (type === 'recovery') return 'recovery'
  return null
}

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason, type } = await searchParams
  const kind = kindOf(type)
  const reasonKey = reason === 'expired' || reason === 'other_browser' || reason === 'invalid' ? reason : 'invalid'
  const title = kind ? COPY[kind].title[reasonKey] : "This link isn't valid"
  const body = reason === 'other_browser'
    ? 'This link has to be opened in the browser where you requested it. You can request a new link from any browser.'
    : 'Email links only work once and expire after a short time.'
  const step = kind ? COPY[kind].step : 'Go back to sign in and try again.'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">
          {body} {step}
        </p>
        <div className="flex flex-col items-center gap-3 pt-2">
          {kind ? (
            <Link
              href={COPY[kind].href}
              className="inline-block bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-6 rounded transition"
            >
              {COPY[kind].action}
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-block bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-6 rounded transition"
            >
              Go to sign in
            </Link>
          )}
          {kind === 'invite' && (
            <p className="text-sm text-muted-foreground">Ask your admin for a new invite. This page cannot send one.</p>
          )}
        </div>
      </div>
    </div>
  )
}

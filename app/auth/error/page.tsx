import Link from 'next/link'

interface Props {
  searchParams: Promise<{ reason?: string; type?: string }>
}

const TITLES: Record<string, string> = {
  expired: 'This link has expired or was already used',
  other_browser: 'Please open the link in the same browser',
  invalid: "This link isn't valid",
}

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason, type } = await searchParams
  const title = TITLES[reason ?? ''] ?? TITLES.invalid
  const isInvite = type === 'invite'
  const isSignup = type === 'signup'

  let body = 'Email links only work once and expire after a short time.'
  if (reason === 'other_browser') {
    body = 'This link has to be opened in the browser where you requested it. You can request a new link from any browser.'
  }
  const nextStep = isInvite
    ? 'Ask the person who invited you to send a new invite.'
    : isSignup
      ? 'Go back to signup and resend the confirmation email.'
      : 'You can request a new password reset link below.'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">
          {body} {nextStep}
        </p>
        <div className="flex flex-col items-center gap-3 pt-2">
          <Link
            href="/login"
            className="inline-block bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-6 rounded transition"
          >
            Go to sign in
          </Link>
          {isSignup && (
            <Link href="/signup" className="text-sm text-primary font-semibold hover:underline">
              Back to signup
            </Link>
          )}
          {!isInvite && !isSignup && (
            <Link href="/forgot-password" className="text-sm text-primary font-semibold hover:underline">
              Send a new reset link
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

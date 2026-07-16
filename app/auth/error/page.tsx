export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Authentication Error</h1>
        <p className="text-muted-foreground mb-6">
          Something went wrong during sign-in. The link may have expired or is invalid.
        </p>
        <a
          href="/admin"
          className="inline-block bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded transition"
        >
          Return to Admin Login
        </a>
      </div>
    </div>
  )
}

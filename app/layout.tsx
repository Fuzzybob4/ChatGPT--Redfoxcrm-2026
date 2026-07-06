import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RedFox CRM 2026',
  description: 'A focused CRM for holiday lighting and field service companies.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

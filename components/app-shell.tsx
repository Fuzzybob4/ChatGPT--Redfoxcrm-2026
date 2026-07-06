import Link from 'next/link'
import { CalendarDays, FileText, Home, Settings, Users, WalletCards } from 'lucide-react'
import { RedFoxLogo } from './redfox-logo'

const nav = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/jobs', label: 'Jobs', icon: CalendarDays },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/portal', label: 'Portal', icon: WalletCards },
  { href: '/settings', label: 'Settings', icon: Settings }
]

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F3EE]">
      <aside className="fixed left-0 top-0 hidden h-full w-72 border-r border-slate-200 bg-white p-5 lg:block">
        <RedFoxLogo />
        <nav className="mt-8 space-y-2">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-red-50 hover:text-[#D9352A]">
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-3xl bg-slate-950 p-4 text-white">
          <p className="text-xs uppercase tracking-wide text-red-200">MVP Focus</p>
          <p className="mt-2 text-sm font-semibold">Customers → Properties → Jobs → Invoice → Payment</p>
        </div>
      </aside>
      <main className="lg:pl-72">
        <div className="mx-auto max-w-7xl p-5 lg:p-8">{children}</div>
      </main>
    </div>
  )
}

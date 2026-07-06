import { AppShell } from '@/components/app-shell'

const settings = ['Supabase project URL', 'Supabase anon key', 'Stripe key', 'Resend key', 'Mapbox token', 'Vercel domain']

export default function SettingsPage() {
  return (
    <AppShell>
      <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#D9352A]">Settings</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Integration checklist</h1>
      <p className="mt-2 text-slate-600">These are placeholders for the live services that will be connected in the next build pass.</p>
      <div className="mt-6 grid gap-3">
        {settings.map((setting) => (
          <div key={setting} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5">
            <span className="font-bold text-slate-800">{setting}</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Needs key</span>
          </div>
        ))}
      </div>
    </AppShell>
  )
}

import { AppShell } from '@/components/app-shell'
import { addOns } from '@/lib/mock-data'

export default function PortalPage() {
  return (
    <AppShell>
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#D9352A]">Customer Portal</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Approve your lighting plan</h1>
        <p className="mt-2 text-slate-600">Customers can review the proposal, choose add-ons, and submit approval from one clean page.</p>
        <div className="mt-6 rounded-3xl bg-slate-950 p-6 text-white">
          <h2 className="text-2xl font-black">Recommended add-ons</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {addOns.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white/10 p-4">
                <h3 className="font-black">{item.name}</h3>
                <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                <p className="mt-3 font-black text-red-200">${item.unitPrice} / {item.unit}</p>
              </div>
            ))}
          </div>
          <button className="mt-6 rounded-2xl bg-[#D9352A] px-5 py-3 font-black text-white">Approve selected items</button>
        </div>
      </section>
    </AppShell>
  )
}

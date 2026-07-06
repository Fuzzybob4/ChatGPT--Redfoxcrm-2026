import { AppShell } from '@/components/app-shell'
import { addOns } from '@/lib/mock-data'

export default function InvoicesPage() {
  const base = 1850
  const sampleAddOns = addOns.slice(0, 3)
  const addOnTotal = sampleAddOns.reduce((sum, item) => sum + item.unitPrice, 0)
  const total = base + addOnTotal
  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#D9352A]">Invoice Builder</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Build the quote and offer add-ons</h1>
          <p className="mt-2 text-slate-600">Businesses set their own prices. Customers can approve extras from the portal.</p>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <div className="flex justify-between text-sm font-bold"><span>Base holiday lighting package</span><span>${base.toLocaleString()}</span></div>
          </div>
          <div className="mt-4 space-y-3">
            {sampleAddOns.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black text-slate-950">{item.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                  </div>
                  <p className="font-black text-[#D9352A]">${item.unitPrice}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="rounded-3xl bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/20">
          <h2 className="text-2xl font-black">Customer invoice preview</h2>
          <div className="mt-6 space-y-4">
            <Line label="Package" value={base} />
            <Line label="Selected add-ons" value={addOnTotal} />
            <div className="border-t border-white/10 pt-4">
              <Line label="Total due" value={total} strong />
            </div>
          </div>
          <button className="mt-6 w-full rounded-2xl bg-[#D9352A] px-5 py-3 font-black text-white">Send for approval</button>
        </aside>
      </div>
    </AppShell>
  )
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? 'text-xl font-black' : 'text-sm font-semibold text-slate-300'}`}><span>{label}</span><span>${value.toLocaleString()}</span></div>
}

import { AppShell } from '@/components/app-shell'

const clients = [
  { id: '1', name: 'ABC Property Management', type: 'Property Manager', locations: ['HOA Entrance 1', 'Clubhouse'] },
  { id: '2', name: 'Sarah Johnson', type: 'Residential', locations: ['Primary Residence'] }
]

export default function ClientsPage() {
  return (
    <AppShell>
      <h1 className="text-4xl font-black text-slate-950">Client profiles</h1>
      <p className="mt-2 text-slate-600">Each profile can contain multiple service locations.</p>
      <div className="mt-6 grid gap-5">
        {clients.map((client) => (
          <article key={client.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
            <h2 className="text-2xl font-black">{client.name}</h2>
            <p className="text-sm text-slate-500">{client.type}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {client.locations.map((location) => <span key={location} className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#D9352A]">{location}</span>)}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  )
}

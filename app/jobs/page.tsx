import { AppShell } from '@/components/app-shell'
import { jobs } from '@/lib/mock-data'

export default function JobsPage() {
  return (
    <AppShell>
      <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#D9352A]">Jobs</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Schedule and crew board</h1>
      <div className="mt-6 grid gap-4">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black">{job.customer}</h2>
                <p className="mt-1 text-sm text-slate-500">{job.property} • {job.date} • {job.crew}</p>
              </div>
              <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#D9352A]">{job.status}</span>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  )
}

import { AppShell } from '@/components/app-shell'
import { customers, jobs } from '@/lib/mock-data'

export default function DashboardPage() {
  const revenue = jobs.reduce((sum, job) => sum + job.value, 0)
  return (
    <AppShell>
      <section className="redfox-gradient rounded-[2rem] p-8 text-white shadow-2xl shadow-slate-900/15">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-100">RedFox CRM 2026</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight lg:text-6xl">Run your lighting company from one clean dashboard.</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-200">A focused MVP for customers, service properties, jobs, invoices, add-ons, and customer approvals.</p>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Metric title="Customers" value={customers.length.toString()} helper="Multi-property profiles" />
        <Metric title="Open Jobs" value={jobs.length.toString()} helper="Install and service work" />
        <Metric title="Pipeline Value" value={`$${revenue.toLocaleString()}`} helper="Mock MVP revenue" />
      </section>
    </AppShell>
  )
}

function Metric({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-4xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </div>
  )
}

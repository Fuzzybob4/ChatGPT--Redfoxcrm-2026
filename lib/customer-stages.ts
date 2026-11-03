import { deriveLifecycleStatus, invoicePaymentSignal, type LifecycleStatus } from "@/lib/lifecycle";

type Row = Record<string, any>;

/**
 * Build a per-customer lifecycle stage lookup from raw customer, job, and
 * invoice rows. Column sets differ slightly between environments (e.g.
 * amount_paid vs amount_paid_cents), so rows are normalized here.
 */
export function buildStageResolver({
  customers,
  jobs,
  invoices,
}: {
  customers: Row[];
  jobs: Row[];
  invoices: Row[];
}): (customerId: string) => LifecycleStatus {
  const customerMap = new Map<string, Row>();
  for (const c of customers) customerMap.set(c.id, c);

  const jobsByCustomer = new Map<string, Row[]>();
  for (const j of jobs) {
    if (!j.customer_id) continue;
    const list = jobsByCustomer.get(j.customer_id) ?? [];
    list.push(j);
    jobsByCustomer.set(j.customer_id, list);
  }

  const paymentsByCustomer = new Map<string, { paid: boolean; deposit: boolean; unpaid: boolean }>();
  for (const inv of invoices) {
    if (!inv.customer_id) continue;
    const amountPaid =
      inv.amount_paid != null
        ? Number(inv.amount_paid)
        : inv.amount_paid_cents != null
          ? Number(inv.amount_paid_cents) / 100
          : 0;
    const signal = invoicePaymentSignal({ status: inv.status, paymentState: inv.payment_state, amountPaid });
    const current = paymentsByCustomer.get(inv.customer_id) ?? { paid: false, deposit: false, unpaid: false };
    paymentsByCustomer.set(inv.customer_id, {
      paid: current.paid || signal.paid,
      deposit: current.deposit || signal.deposit,
      unpaid: current.unpaid || signal.unpaid,
    });
  }

  const cache = new Map<string, LifecycleStatus>();
  return (customerId: string) => {
    const cached = cache.get(customerId);
    if (cached) return cached;

    const payments = paymentsByCustomer.get(customerId);
    const stage = deriveLifecycleStatus({
      hasUnpaidInvoice: payments?.unpaid ?? false,
      hasPaidInvoice: payments?.paid ?? false,
      hasDepositPaid: payments?.deposit ?? false,
      jobs: (jobsByCustomer.get(customerId) ?? []).map((j) => ({
        status: j.status ?? "",
        jobType: j.job_type,
        date: j.scheduled_date,
        hasCrew:
          Boolean(String(j.crew_name ?? "").trim()) ||
          (Array.isArray(j.assigned_employees) && j.assigned_employees.length > 0),
      })),
      installStatus: customerMap.get(customerId)?.install_status ?? null,
    });
    cache.set(customerId, stage);
    return stage;
  };
}

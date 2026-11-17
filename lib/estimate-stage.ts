/**
 * Where an estimate is in the sales flow, in plain words:
 * Draft → Sent → Approved · pending payment → Paid · on invoice (then it's
 * on the schedule's "Needs scheduling" list). Plus Declined / Archived.
 */
export type EstimateStageKey = 'draft' | 'sent' | 'approved' | 'paid' | 'declined' | 'expired' | 'archived';

export interface EstimateStage {
  key: EstimateStageKey;
  label: string;
  /** Tailwind classes for the status chip. */
  chip: string;
}

const STAGES: Record<EstimateStageKey, Omit<EstimateStage, 'key'>> = {
  draft: { label: 'Draft', chip: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', chip: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Approved · pending payment', chip: 'bg-amber-100 text-amber-900' },
  paid: { label: 'Paid · moved to invoice', chip: 'bg-emerald-100 text-emerald-800' },
  declined: { label: 'Declined', chip: 'bg-red-100 text-red-800' },
  expired: { label: 'Expired', chip: 'bg-muted text-muted-foreground' },
  archived: { label: 'Archived', chip: 'bg-muted text-muted-foreground' },
};

export function estimateStage(
  est: { status: string; invoiceId?: string | null; archivedAt?: string | null },
  invoice?: { amountPaid?: number; status?: string } | null,
): EstimateStage {
  const status = String(est.status ?? '').toLowerCase();
  let key: EstimateStageKey;
  if (est.archivedAt) key = 'archived';
  else if (status === 'declined' || status === 'rejected') key = 'declined';
  else if (status === 'expired') key = 'expired';
  else if (est.invoiceId || status === 'accepted' || status === 'converted') {
    const paid = Number(invoice?.amountPaid ?? 0) > 0 || String(invoice?.status ?? '').toLowerCase() === 'paid';
    key = paid ? 'paid' : 'approved';
  } else if (status === 'draft') key = 'draft';
  else key = 'sent';
  return { key, ...STAGES[key] };
}

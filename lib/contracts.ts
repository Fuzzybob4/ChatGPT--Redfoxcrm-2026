import "server-only";

type Db = any;

export interface ContractView {
  id: string;
  status: string;
  yearlyAmount: number;
  startYear: number;
  years: number;
  percent: number;
  months: number[];
  notes: string | null;
  signedName: string | null;
  signedDate: string | null;
  invoices: { id: string; number: string | null; title: string | null; total: number; paid: number; dueSoFar: number; status: string }[];
}

export async function loadCustomerContract(db: Db, orgId: string, customerId: string): Promise<ContractView | null> {
  const { data: k } = await db
    .from("contracts")
    .select("id, status, contract_value, term_start_year, term_years, installment_percent, billing_months, notes, signed_name, signed_date")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!k) return null;
  const { data: invs } = await db
    .from("invoices")
    .select("id, invoice_number, title, total_amount, amount_paid, deposit_amount, status")
    .eq("org_id", orgId)
    .eq("contract_id", k.id)
    .order("created_at", { ascending: false });
  return {
    id: k.id,
    status: k.status,
    yearlyAmount: Number(k.contract_value ?? 0),
    startYear: Number(k.term_start_year),
    years: Number(k.term_years ?? 1),
    percent: Number(k.installment_percent ?? 10),
    months: (k.billing_months as number[] | null) ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    notes: k.notes ?? null,
    signedName: k.signed_name ?? null,
    signedDate: k.signed_date ?? null,
    invoices: (invs ?? []).map((i: any) => ({
      id: i.id,
      number: i.invoice_number,
      title: i.title,
      total: Number(i.total_amount ?? 0),
      paid: Number(i.amount_paid ?? 0),
      dueSoFar: Number(i.deposit_amount ?? 0),
      status: i.status,
    })),
  };
}

export function validMonths(months: unknown): number[] {
  const list = Array.isArray(months) ? months.map(Number).filter((m) => m >= 1 && m <= 12) : [];
  return [...new Set(list)].sort((a, b) => a - b);
}

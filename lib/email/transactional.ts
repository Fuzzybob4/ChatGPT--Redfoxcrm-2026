import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { ensurePortalToken } from "@/lib/estimates/approval";

type Db = ReturnType<typeof createAdminClient>;

export type TransactionalKind =
  | "invoice_sent"
  | "due_soon"
  | "overdue_1"
  | "overdue_2"
  | "overdue_3"
  | "estimate_sent"
  | "payment_receipt"
  | "rebook_offer"
  | "contract_installment";

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.redfoxcrm.com").replace(/\/$/, "");
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const day = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

export interface BusinessSender {
  name: string;
  email: string | null;
  phone: string | null;
}

export async function getBusinessSender(db: Db, orgId: string): Promise<BusinessSender> {
  const [{ data: profile }, { data: org }] = await Promise.all([
    db.from("business_profiles").select("business_name, email, phone").eq("org_id", orgId).maybeSingle(),
    db.from("organizations").select("name").eq("id", orgId).maybeSingle(),
  ]);
  return {
    name: profile?.business_name || org?.name || "Your contractor",
    email: profile?.email || null,
    phone: profile?.phone || null,
  };
}

/** Simple, friendly, mobile-friendly email layout shared by every transactional message. */
export function renderEmail(opts: {
  business: BusinessSender;
  greeting: string;
  paragraphs: string[];
  details?: Array<[string, string]>;
  button?: { text: string; url: string };
  /** A second, quieter choice under the main button. */
  secondaryLink?: { text: string; url: string };
  footerNote?: string;
}): string {
  const details = (opts.details ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 0;color:#52514e">${esc(k)}</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#0b0b0b">${esc(v)}</td></tr>`,
    )
    .join("");
  const contact = [opts.business.phone, opts.business.email].filter(Boolean).map(esc).join(" · ");
  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:18px;font-weight:700;color:#0b0b0b;padding-bottom:16px">${esc(opts.business.name)}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#0b0b0b">
<p style="margin:0 0 12px">${esc(opts.greeting)}</p>
${opts.paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join("")}
${details ? `<table role="presentation" width="100%" style="margin:8px 0 16px;border-top:1px solid #e7e6e2;border-bottom:1px solid #e7e6e2;padding:8px 0;font-size:14px">${details}</table>` : ""}
${opts.button ? `<p style="margin:20px 0"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#c2381e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">${esc(opts.button.text)}</a></p>` : ""}
${opts.secondaryLink ? `<p style="margin:-8px 0 20px"><a href="${esc(opts.secondaryLink.url)}" style="color:#c2381e;font-weight:600">${esc(opts.secondaryLink.text)}</a></p>` : ""}
<p style="margin:16px 0 0;color:#52514e;font-size:13px">Questions? Just reply to this email${contact ? ` or reach us at ${contact}` : ""}.</p>
</td></tr>
${opts.footerNote ? `<tr><td style="padding-top:20px;font-size:12px;color:#8a8984">${opts.footerNote}</td></tr>` : ""}
</table>
<p style="font-size:11px;color:#a3a29c;margin:12px 0 0">Sent by ${esc(opts.business.name)} using Red Fox CRM</p>
</td></tr></table></body></html>`;
}

async function logEmail(
  db: Db,
  row: { org_id: string; invoice_id?: string | null; estimate_id?: string | null; kind: TransactionalKind; email_address: string; status: "sent" | "failed"; error?: string | null; provider_id?: string | null },
) {
  const { error } = await db.from("invoice_reminder_log").insert(row);
  return error;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email sending isn't set up yet. Add the Resend key in Vercel to turn it on.");
  }
}

interface InvoiceForEmail {
  id: string;
  org_id: string;
  customer_id: string;
  invoice_number: string | null;
  title: string | null;
  total_amount: number | string | null;
  amount_paid: number | string | null;
  deposit_amount: number | string | null;
  due_date: string | null;
  contract_id?: string | null;
}

async function loadInvoiceContext(db: Db, invoiceId: string, orgId: string) {
  const { data: invoice } = await db
    .from("invoices")
    .select("id, org_id, customer_id, invoice_number, title, total_amount, amount_paid, deposit_amount, due_date, contract_id")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!invoice) throw new Error("Invoice not found");
  const { data: customer } = await db
    .from("customers")
    .select("first_name, full_name, email, billing_email, invoice_reminders_opt_out")
    .eq("id", invoice.customer_id)
    .eq("org_id", orgId)
    .maybeSingle();
  return { invoice: invoice as InvoiceForEmail, customer };
}

/**
 * Emails one invoice-related message to the customer with a link to their
 * portal (where they can pay). Records every attempt in invoice_reminder_log.
 */
export async function sendInvoiceEmail(
  db: Db,
  orgId: string,
  invoiceId: string,
  kind: Exclude<TransactionalKind, "estimate_sent">,
  options?: { contractOffer?: { years: number; percent: number } },
): Promise<{ to: string }> {
  if (!isEmailConfigured()) throw new EmailNotConfiguredError();
  const { invoice, customer } = await loadInvoiceContext(db, invoiceId, orgId);
  const to = (customer?.billing_email || customer?.email || "").trim();
  if (!to) throw new Error("This customer has no email address.");
  if (!["invoice_sent", "payment_receipt", "rebook_offer", "contract_installment"].includes(kind) && customer?.invoice_reminders_opt_out) {
    throw new Error("This customer has turned off reminders.");
  }

  const business = await getBusinessSender(db, orgId);
  const portalToken = await ensurePortalToken(db, invoice.customer_id, orgId);
  const portalUrl = `${appBaseUrl()}/customer-portal/${encodeURIComponent(portalToken)}`;
  const firstName = (customer?.first_name || customer?.full_name || "").split(" ")[0] || "there";

  const total = Number(invoice.total_amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  const balance = Math.max(total - paid, 0);
  const deposit = Number(invoice.deposit_amount ?? 0);
  const label = invoice.title || `Invoice ${invoice.invoice_number ?? ""}`.trim();
  const number = invoice.invoice_number ? ` ${invoice.invoice_number}` : "";
  const details: Array<[string, string]> = [
    ["Invoice", invoice.invoice_number ?? "—"],
    ["For", label],
    ["Amount due", usd(balance)],
  ];
  if (deposit > paid) details.push([invoice.contract_id ? "Due this month" : "Deposit to book", usd(deposit - paid)]);
  if (invoice.due_date) details.push(["Due", day(invoice.due_date)]);

  const unsubscribeUrl = `${appBaseUrl()}/unsubscribe/reminders/${encodeURIComponent(portalToken)}`;
  const reminderFooter = `Don't want payment reminders? <a href="${esc(unsubscribeUrl)}" style="color:#8a8984">Turn them off</a>.`;

  let subject: string;
  let paragraphs: string[];
  let button: { text: string; url: string } | undefined = { text: deposit > paid ? "View & pay deposit" : "View & pay invoice", url: portalUrl };
  let footerNote: string | undefined;
  let secondaryLink: { text: string; url: string } | undefined;

  switch (kind) {
    case "invoice_sent":
      subject = `Your invoice from ${business.name}`;
      paragraphs = [`Thanks for choosing ${business.name}! Your invoice is ready. You can view it and pay securely online.`];
      break;
    case "due_soon":
      subject = `Friendly reminder: invoice${number} is due ${day(invoice.due_date)}`;
      paragraphs = [`Just a friendly reminder that your invoice from ${business.name} is due soon. If you've already paid, thank you, and please ignore this note.`];
      footerNote = reminderFooter;
      break;
    case "overdue_1":
    case "overdue_2":
    case "overdue_3":
      subject = `Reminder: invoice${number} from ${business.name}`;
      paragraphs = [
        `Our records show a balance of ${usd(balance)} on your invoice from ${business.name}, which was due ${day(invoice.due_date)}.`,
        `If you've already sent payment, thank you! Otherwise you can pay securely online in a minute.`,
      ];
      footerNote = reminderFooter;
      break;
    case "rebook_offer":
      subject = `Book your holiday lights again with ${business.name}`;
      paragraphs = [
        `Thank you for letting ${business.name} light up your home this season! We're taking your lights down soon.`,
        `Want the same setup next season? We've saved your spot at this year's price. Pay the deposit to lock in your install date early.`,
      ];
      button = { text: "Rebook & pay deposit", url: portalUrl };
      if (options?.contractOffer) {
        const o = options.contractOffer;
        paragraphs.push(
          `Prefer to spread it out? Lock in this price for ${o.years} years and pay ${o.percent}% a month instead. No deposit needed.`,
        );
        secondaryLink = {
          text: `See the ${o.years}-year monthly plan`,
          url: `${appBaseUrl()}/customer-portal/${encodeURIComponent(portalToken)}/plan?invoice=${encodeURIComponent(invoiceId)}`,
        };
      }
      break;
    case "contract_installment":
      subject = `This month's contract payment for ${business.name}`;
      paragraphs = [
        `A friendly reminder that this month's payment on your lighting contract with ${business.name} is due.`,
        `You can pay this month's amount, or pay ahead, securely online.`,
      ];
      button = { text: "View & pay", url: portalUrl };
      break;
    case "payment_receipt":
      subject = `Payment received — thank you!`;
      paragraphs = [
        `We received your payment. Thank you for choosing ${business.name}!`,
        balance > 0 ? `Remaining balance: ${usd(balance)}.` : `Your invoice is paid in full.`,
      ];
      details.splice(2, 1, ["Paid so far", usd(paid)]);
      button = { text: "View receipt", url: portalUrl };
      break;
  }

  const html = renderEmail({ business, greeting: `Hi ${firstName},`, paragraphs, details, button, secondaryLink, footerNote });
  try {
    const result = await sendEmail({ to, subject, html, fromName: business.name, replyTo: business.email });
    await logEmail(db, { org_id: orgId, invoice_id: invoiceId, kind, email_address: to, status: "sent", provider_id: result.data?.id ?? null });
    return { to };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await logEmail(db, { org_id: orgId, invoice_id: invoiceId, kind, email_address: to, status: "failed", error: message.slice(0, 500) });
    throw err;
  }
}

/** Emails the estimate approval link to the customer. */
export async function sendEstimateEmail(
  db: Db,
  orgId: string,
  estimate: { id: string; customer_id: string; estimate_number: string | null; title: string | null; total_amount: number | string | null; deposit_percent: number | string | null; valid_until?: string | null },
  approvalUrl: string,
): Promise<{ to: string }> {
  if (!isEmailConfigured()) throw new EmailNotConfiguredError();
  const { data: customer } = await db
    .from("customers")
    .select("first_name, full_name, email, billing_email")
    .eq("id", estimate.customer_id)
    .eq("org_id", orgId)
    .maybeSingle();
  const to = (customer?.email || customer?.billing_email || "").trim();
  if (!to) throw new Error("This customer has no email address.");

  const business = await getBusinessSender(db, orgId);
  const firstName = (customer?.first_name || customer?.full_name || "").split(" ")[0] || "there";
  const total = Number(estimate.total_amount ?? 0);
  const pct = Number(estimate.deposit_percent ?? 0);
  const details: Array<[string, string]> = [
    ["Estimate", estimate.estimate_number ?? "—"],
    ["For", estimate.title || "Your project"],
    ["Total", usd(total)],
  ];
  if (pct > 0) details.push([`Deposit to book (${pct}%)`, usd(Math.round(total * pct) / 100)]);
  if (estimate.valid_until) details.push(["Valid until", day(estimate.valid_until)]);

  const html = renderEmail({
    business,
    greeting: `Hi ${firstName},`,
    paragraphs: [
      `Thanks for the chance to light up your home! Here's your estimate from ${business.name}.`,
      `You can review it and approve it online with your signature${pct > 0 ? ", then pay the deposit to lock in your install date" : ""}.`,
    ],
    details,
    button: { text: "Review & approve estimate", url: approvalUrl },
  });
  try {
    const result = await sendEmail({ to, subject: `Your estimate from ${business.name}`, html, fromName: business.name, replyTo: business.email });
    await logEmail(db, { org_id: orgId, estimate_id: estimate.id, kind: "estimate_sent", email_address: to, status: "sent", provider_id: result.data?.id ?? null });
    return { to };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await logEmail(db, { org_id: orgId, estimate_id: estimate.id, kind: "estimate_sent", email_address: to, status: "failed", error: message.slice(0, 500) });
    throw err;
  }
}

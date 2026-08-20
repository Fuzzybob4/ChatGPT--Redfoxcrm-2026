'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPortalToken } from './portal-actions';

export interface PortalInvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PortalInvoiceAddon {
  id: string;
  name: string;
  description: string | null;
  price: number;
  maxQuantity: number;
  selectedQuantity: number;
}

export interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  title: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  depositAmount: number;
  amountPaid: number;
  dueDate: string | null;
  notes: string | null;
  allowAddons: boolean;
  createdAt: string;
  lineItems: PortalInvoiceLineItem[];
  addons: PortalInvoiceAddon[];
  addonsTotal: number;
  grandTotal: number;
}

/**
 * Verify a portal token belongs to the given customer/org, throwing if not.
 * Every mutation below re-verifies the token so a stale or forged customerId
 * can never be used to read or write another customer's invoice data.
 */
async function requireCustomerFromToken(token: string) {
  const customer = await verifyPortalToken(token);
  if (!customer) throw new Error('Invalid or expired portal link');
  return customer as { id: string; org_id: string; email: string };
}

/**
 * Fetch all invoices for the authenticated portal customer, including line
 * items and any optional add-on products they can choose to add.
 */
export async function getPortalInvoices(token: string): Promise<PortalInvoice[]> {
  const customer = await requireCustomerFromToken(token);
  const admin = createAdminClient();

  const { data: invoices, error: invErr } = await admin
    .from('invoices')
    .select(
      'id, invoice_number, title, status, subtotal, tax_rate, tax_amount, total_amount, deposit_amount, amount_paid, due_date, notes, allow_addons, created_at',
    )
    .eq('customer_id', customer.id)
    .eq('org_id', customer.org_id)
    .eq('archived', false)
    .order('created_at', { ascending: false });

  if (invErr) throw new Error(invErr.message);
  if (!invoices || invoices.length === 0) return [];

  const invoiceIds = invoices.map((inv) => inv.id);

  const [{ data: lineItems, error: liErr }, { data: addonProducts, error: apErr }, { data: selections, error: selErr }] =
    await Promise.all([
      admin
        .from('invoice_line_items')
        .select('id, invoice_id, description, quantity, unit_price, line_total, sort_order')
        .in('invoice_id', invoiceIds)
        .order('sort_order', { ascending: true }),
      admin
        .from('invoice_addon_products')
        .select('id, invoice_id, name, description, price, max_quantity, sort_order')
        .in('invoice_id', invoiceIds)
        .order('sort_order', { ascending: true }),
      admin
        .from('invoice_addon_selections')
        .select('invoice_id, addon_product_id, quantity')
        .in('invoice_id', invoiceIds),
    ]);

  if (liErr) throw new Error(liErr.message);
  if (apErr) throw new Error(apErr.message);
  if (selErr) throw new Error(selErr.message);

  return invoices.map((inv) => {
    const addons = (addonProducts ?? [])
      .filter((a) => a.invoice_id === inv.id)
      .map((a) => {
        const selection = (selections ?? []).find((s) => s.addon_product_id === a.id);
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          price: Number(a.price),
          maxQuantity: a.max_quantity,
          selectedQuantity: selection?.quantity ?? 0,
        };
      });

    const addonsTotal = addons.reduce((sum, a) => sum + a.price * a.selectedQuantity, 0);
    const totalAmount = Number(inv.total_amount);

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      title: inv.title,
      status: inv.status,
      subtotal: Number(inv.subtotal),
      taxRate: Number(inv.tax_rate),
      taxAmount: Number(inv.tax_amount),
      totalAmount,
      depositAmount: Number(inv.deposit_amount ?? 0),
      amountPaid: Number(inv.amount_paid ?? 0),
      dueDate: inv.due_date,
      notes: inv.notes,
      allowAddons: Boolean(inv.allow_addons),
      createdAt: inv.created_at,
      lineItems: (lineItems ?? [])
        .filter((li) => li.invoice_id === inv.id)
        .map((li) => ({
          id: li.id,
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unit_price),
          lineTotal: Number(li.line_total),
        })),
      addons,
      addonsTotal,
      grandTotal: totalAmount + addonsTotal,
    };
  });
}

/**
 * Add, update, or remove a customer's selection of an optional add-on item
 * on one of their own invoices. Quantity of 0 removes the selection.
 */
export async function setPortalInvoiceAddonSelection(
  token: string,
  invoiceId: string,
  addonProductId: string,
  quantity: number,
): Promise<{ addonsTotal: number; grandTotal: number }> {
  const customer = await requireCustomerFromToken(token);
  const admin = createAdminClient();

  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 99) {
    throw new Error('Invalid quantity');
  }

  // Verify the invoice belongs to this customer's org and this customer
  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .select('id, org_id, customer_id, total_amount, amount_paid, allow_addons')
    .eq('id', invoiceId)
    .single();

  if (invErr || !invoice) throw new Error('Invoice not found');
  if (invoice.customer_id !== customer.id || invoice.org_id !== customer.org_id) {
    throw new Error('You do not have access to this invoice');
  }
  if (!invoice.allow_addons) throw new Error('Optional add-ons are not enabled on this invoice');

  // Verify the add-on product belongs to this exact invoice
  const { data: addon, error: addonErr } = await admin
    .from('invoice_addon_products')
    .select('id, price, max_quantity')
    .eq('id', addonProductId)
    .eq('invoice_id', invoiceId)
    .single();

  if (addonErr || !addon) throw new Error('Add-on item not found on this invoice');
  if (quantity > addon.max_quantity) {
    throw new Error(`Only up to ${addon.max_quantity} of this item can be added`);
  }

  if (quantity === 0) {
    const { error: delErr } = await admin
      .from('invoice_addon_selections')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('addon_product_id', addonProductId);
    if (delErr) throw new Error(delErr.message);
  } else {
    const { error: upsertErr } = await admin.from('invoice_addon_selections').upsert(
      {
        org_id: customer.org_id,
        invoice_id: invoiceId,
        addon_product_id: addonProductId,
        quantity,
        selected_at: new Date().toISOString(),
      },
      { onConflict: 'invoice_id,addon_product_id' },
    );
    if (upsertErr) throw new Error(upsertErr.message);
  }

  // Recompute the addons total for this invoice and keep balance_due in sync
  // so the business sees the customer's picks reflected on their side too.
  const { data: allAddons, error: allAddonsErr } = await admin
    .from('invoice_addon_products')
    .select('id, price')
    .eq('invoice_id', invoiceId);
  if (allAddonsErr) throw new Error(allAddonsErr.message);

  const { data: allSelections, error: allSelectionsErr } = await admin
    .from('invoice_addon_selections')
    .select('addon_product_id, quantity')
    .eq('invoice_id', invoiceId);
  if (allSelectionsErr) throw new Error(allSelectionsErr.message);

  const addonsTotal = (allAddons ?? []).reduce((sum, a) => {
    const sel = (allSelections ?? []).find((s) => s.addon_product_id === a.id);
    return sum + Number(a.price) * (sel?.quantity ?? 0);
  }, 0);

  const totalAmount = Number(invoice.total_amount);
  const amountPaid = Number(invoice.amount_paid ?? 0);

  const { error: updateErr } = await admin
    .from('invoices')
    .update({ balance_due: Math.max(totalAmount + addonsTotal - amountPaid, 0) })
    .eq('id', invoiceId);
  if (updateErr) throw new Error(updateErr.message);

  return { addonsTotal, grandTotal: totalAmount + addonsTotal };
}

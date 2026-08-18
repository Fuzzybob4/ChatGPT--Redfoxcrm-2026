'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentOrg } from '@/lib/org';
import { createNotification } from '@/app/(crm)/notifications/actions';

// ---------- Types ----------
export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  price: number;
  cost: number;
  quantity: number;
  min_quantity: number;
  unit: string;
  is_active: boolean;
  low_stock_alert_enabled: boolean;
  supplier_id: string | null;
  supplier_name?: string | null;
  last_restocked_at: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string | null;
  supplier_name?: string | null;
  status: string;
  notes: string | null;
  total_cost: number;
  expected_at: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  quantity_received: number;
}

// ---------- Helpers ----------
async function requireOrg() {
  const org = await getCurrentOrg();
  if (!org) throw new Error('Not authenticated');
  return org;
}

/**
 * Apply a stock delta to a product, write an inventory_transactions audit row,
 * and open/resolve a low-stock alert as needed. Uses the admin client so the
 * atomic-ish sequence isn't blocked by RLS mid-way; all rows are org-scoped.
 */
async function applyStockChange(params: {
  orgId: string;
  userId: string;
  productId: string;
  delta: number;
  transactionType: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}) {
  const admin = createAdminClient();

  const { data: product, error: prodErr } = await admin
    .from('products')
    .select('id, name, quantity, min_quantity, low_stock_alert_enabled')
    .eq('id', params.productId)
    .eq('org_id', params.orgId)
    .single();
  if (prodErr || !product) throw new Error('Product not found');

  const before = product.quantity ?? 0;
  const after = before + params.delta;
  if (after < 0) throw new Error(`Not enough stock for ${product.name} (have ${before})`);

  const updates: Record<string, unknown> = { quantity: after, updated_at: new Date().toISOString() };
  if (params.delta > 0) updates.last_restocked_at = new Date().toISOString();

  const { error: updErr } = await admin
    .from('products')
    .update(updates)
    .eq('id', params.productId)
    .eq('org_id', params.orgId);
  if (updErr) throw new Error(updErr.message);

  await admin.from('inventory_transactions').insert({
    org_id: params.orgId,
    product_id: params.productId,
    transaction_type: params.transactionType,
    quantity_change: params.delta,
    quantity_before: before,
    quantity_after: after,
    reference_type: params.referenceType ?? null,
    reference_id: params.referenceId ?? null,
    notes: params.notes ?? null,
    created_by: params.userId,
  });

  // Low-stock alerting
  const min = product.min_quantity ?? 0;
  if (product.low_stock_alert_enabled) {
    if (after <= min) {
      // At/below threshold: try to open an alert. A partial unique index
      // (one open alert per product) makes this race-safe — a concurrent
      // adjustment that already opened the alert will conflict here, and we
      // only notify when THIS call actually inserted the row.
      const { data: inserted, error: insertErr } = await admin
        .from('inventory_alerts')
        .insert({
          org_id: params.orgId,
          product_id: params.productId,
          alert_type: after === 0 ? 'out_of_stock' : 'low_stock',
          current_quantity: after,
          min_quantity: min,
          notified_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();

      if (inserted && !insertErr) {
        // Newly opened alert — notify the business (best-effort).
        try {
          await createNotification({
            orgId: params.orgId,
            type: 'low_stock',
            title: `Low stock: ${product.name}`,
            message: `${product.name} is down to ${after} (reorder at ${min}). Consider creating a purchase order.`,
            relatedId: params.productId,
          });
        } catch (e) {
          console.error('Low-stock notification failed:', e);
        }
      } else {
        // Alert already open — just keep its current_quantity fresh.
        await admin
          .from('inventory_alerts')
          .update({ current_quantity: after, alert_type: after === 0 ? 'out_of_stock' : 'low_stock' })
          .eq('product_id', params.productId)
          .eq('is_resolved', false);
      }
    } else {
      // Restocked above threshold: resolve any open alerts
      await admin
        .from('inventory_alerts')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('product_id', params.productId)
        .eq('is_resolved', false);
    }
  }

  return { before, after };
}

// ---------- Products ----------
export async function getInventoryOverview() {
  const org = await requireOrg();
  const supabase = await createClient();

  const [productsRes, suppliersRes, alertsRes, posRes] = await Promise.all([
    supabase
      .from('products')
      .select('*, suppliers(name)')
      .eq('org_id', org.orgId)
      .order('name'),
    supabase.from('suppliers').select('*').eq('org_id', org.orgId).order('name'),
    supabase
      .from('inventory_alerts')
      .select('*, products(name)')
      .eq('org_id', org.orgId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('purchase_orders')
      .select('*, suppliers(name)')
      .eq('org_id', org.orgId)
      .order('created_at', { ascending: false }),
  ]);

  const products: Product[] = (productsRes.data ?? []).map((p: any) => ({
    ...p,
    supplier_name: p.suppliers?.name ?? null,
  }));

  const purchaseOrders: PurchaseOrder[] = (posRes.data ?? []).map((po: any) => ({
    ...po,
    supplier_name: po.suppliers?.name ?? null,
  }));

  return {
    products,
    suppliers: (suppliersRes.data ?? []) as Supplier[],
    alerts: (alertsRes.data ?? []).map((a: any) => ({ ...a, product_name: a.products?.name ?? 'Unknown' })),
    purchaseOrders,
  };
}

const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  price: z.number().min(0),
  cost: z.number().min(0),
  quantity: z.number().int().min(0),
  minQuantity: z.number().int().min(0),
  unit: z.string().max(30).optional(),
  supplierId: z.string().uuid().optional().nullable(),
  lowStockAlertEnabled: z.boolean().optional(),
});

export async function createProduct(input: z.infer<typeof productSchema>) {
  const org = await requireOrg();
  const data = productSchema.parse(input);
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      org_id: org.orgId,
      created_by: org.userId,
      name: data.name,
      description: data.description ?? null,
      sku: data.sku ?? null,
      barcode: data.barcode ?? null,
      category: data.category ?? null,
      price: data.price,
      cost: data.cost,
      quantity: data.quantity,
      min_quantity: data.minQuantity,
      unit: data.unit ?? 'each',
      supplier_id: data.supplierId ?? null,
      low_stock_alert_enabled: data.lowStockAlertEnabled ?? true,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  revalidatePath('/inventory');
  return product.id as string;
}

export async function updateProduct(id: string, input: z.infer<typeof productSchema>) {
  const org = await requireOrg();
  const data = productSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from('products')
    .update({
      name: data.name,
      description: data.description ?? null,
      sku: data.sku ?? null,
      barcode: data.barcode ?? null,
      category: data.category ?? null,
      price: data.price,
      cost: data.cost,
      min_quantity: data.minQuantity,
      unit: data.unit ?? 'each',
      supplier_id: data.supplierId ?? null,
      low_stock_alert_enabled: data.lowStockAlertEnabled ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', org.orgId);
  if (error) throw new Error(error.message);

  revalidatePath('/inventory');
}

/** Manual stock adjustment (audit, restock, damage, etc.) */
export async function adjustStock(input: { productId: string; delta: number; notes?: string }) {
  const org = await requireOrg();
  const delta = z.number().int().parse(input.delta);
  if (delta === 0) return;
  await applyStockChange({
    orgId: org.orgId,
    userId: org.userId,
    productId: input.productId,
    delta,
    transactionType: delta > 0 ? 'restock' : 'adjustment',
    referenceType: 'manual',
    notes: input.notes,
  });
  revalidatePath('/inventory');
}

// ---------- Suppliers ----------
const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  website: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export async function createSupplier(input: z.infer<typeof supplierSchema>) {
  const org = await requireOrg();
  const data = supplierSchema.parse(input);
  const supabase = await createClient();

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .insert({
      org_id: org.orgId,
      name: data.name,
      contact_name: data.contactName ?? null,
      email: data.email || null,
      phone: data.phone ?? null,
      website: data.website ?? null,
      notes: data.notes ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  revalidatePath('/inventory');
  return supplier.id as string;
}

// ---------- Purchase Orders ----------
const poSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  expectedAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().nullable().optional(),
        description: z.string().min(1).max(300),
        quantity: z.number().int().positive(),
        unitCost: z.number().min(0),
      }),
    )
    .min(1),
});

export async function createPurchaseOrder(input: z.infer<typeof poSchema>) {
  const org = await requireOrg();
  const data = poSchema.parse(input);
  const supabase = await createClient();

  const total = data.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const poNumber = `PO-${Date.now().toString().slice(-8)}`;

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .insert({
      org_id: org.orgId,
      supplier_id: data.supplierId ?? null,
      po_number: poNumber,
      status: 'draft',
      notes: data.notes ?? null,
      total_cost: total,
      expected_at: data.expectedAt || null,
      created_by: org.userId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const itemRows = data.items.map((i, idx) => ({
    org_id: org.orgId,
    purchase_order_id: po.id,
    product_id: i.productId ?? null,
    description: i.description,
    quantity: i.quantity,
    unit_cost: i.unitCost,
    line_total: Math.round(i.quantity * i.unitCost * 100) / 100,
    sort_order: idx,
  }));
  const { error: itemErr } = await supabase.from('purchase_order_items').insert(itemRows);
  if (itemErr) throw new Error(itemErr.message);

  revalidatePath('/inventory');
  return po.id as string;
}

export async function updatePurchaseOrderStatus(input: { poId: string; status: 'ordered' | 'cancelled' }) {
  const org = await requireOrg();
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status: input.status, updated_at: new Date().toISOString() };
  if (input.status === 'ordered') patch.ordered_at = new Date().toISOString();

  const { error } = await supabase
    .from('purchase_orders')
    .update(patch)
    .eq('id', input.poId)
    .eq('org_id', org.orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/inventory');
}

/** Mark a PO received: restock every linked product from its line items. */
export async function receivePurchaseOrder(poId: string) {
  const org = await requireOrg();
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from('purchase_order_items')
    .select('id, product_id, quantity')
    .eq('purchase_order_id', poId)
    .eq('org_id', org.orgId);
  if (error) throw new Error(error.message);

  for (const item of items ?? []) {
    if (item.product_id) {
      await applyStockChange({
        orgId: org.orgId,
        userId: org.userId,
        productId: item.product_id,
        delta: item.quantity,
        transactionType: 'purchase_received',
        referenceType: 'purchase_order',
        referenceId: poId,
      });
      await supabase
        .from('purchase_order_items')
        .update({ quantity_received: item.quantity })
        .eq('id', item.id);
    }
  }

  const { error: poErr } = await supabase
    .from('purchase_orders')
    .update({ status: 'received', received_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', poId)
    .eq('org_id', org.orgId);
  if (poErr) throw new Error(poErr.message);

  revalidatePath('/inventory');
}

// ---------- Job Materials ----------
export async function getJobMaterials(jobId: string) {
  const org = await requireOrg();
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_materials')
    .select('*, products(name, unit, quantity)')
    .eq('job_id', jobId)
    .eq('org_id', org.orgId)
    .order('created_at');
  return (data ?? []).map((m: any) => ({
    ...m,
    product_name: m.products?.name ?? 'Unknown',
    product_unit: m.products?.unit ?? 'each',
    product_on_hand: m.products?.quantity ?? 0,
  }));
}

export async function allocateJobMaterial(input: { jobId: string; productId: string; quantity: number }) {
  const org = await requireOrg();
  const quantity = z.number().int().positive().parse(input.quantity);
  const supabase = await createClient();

  const { error } = await supabase.from('job_materials').insert({
    org_id: org.orgId,
    job_id: input.jobId,
    product_id: input.productId,
    quantity,
    status: 'allocated',
    created_by: org.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/inventory');
}

/** Consume an allocated material: deduct from stock (may trigger low-stock alert). */
export async function consumeJobMaterial(materialId: string) {
  const org = await requireOrg();
  const supabase = await createClient();

  const { data: material, error } = await supabase
    .from('job_materials')
    .select('id, product_id, quantity, status, job_id')
    .eq('id', materialId)
    .eq('org_id', org.orgId)
    .single();
  if (error || !material) throw new Error('Material not found');
  if (material.status === 'consumed') return;

  await applyStockChange({
    orgId: org.orgId,
    userId: org.userId,
    productId: material.product_id,
    delta: -material.quantity,
    transactionType: 'job_usage',
    referenceType: 'job',
    referenceId: material.job_id,
  });

  await supabase
    .from('job_materials')
    .update({ status: 'consumed', consumed_at: new Date().toISOString() })
    .eq('id', materialId)
    .eq('org_id', org.orgId);

  revalidatePath('/inventory');
}

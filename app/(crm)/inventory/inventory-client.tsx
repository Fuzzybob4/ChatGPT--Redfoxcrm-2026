'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Package,
  Plus,
  TriangleAlert,
  Truck,
  ClipboardList,
  Boxes,
  Minus,
  Check,
  Pencil,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  createProduct,
  updateProduct,
  adjustStock,
  createSupplier,
  createPurchaseOrder,
  receivePurchaseOrder,
  updatePurchaseOrderStatus,
  type Product,
  type Supplier,
  type PurchaseOrder,
} from './actions';

interface Props {
  products: Product[];
  suppliers: Supplier[];
  alerts: Array<{ id: string; product_name: string; alert_type: string; current_quantity: number; min_quantity: number }>;
  purchaseOrders: PurchaseOrder[];
}

const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;

export function InventoryClient({ products, suppliers, alerts, purchaseOrders }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Product dialog
  const [productOpen, setProductOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);

  const totalValue = useMemo(
    () => products.reduce((sum, p) => sum + (p.cost ?? 0) * (p.quantity ?? 0), 0),
    [products],
  );
  const lowStockCount = products.filter(
    (p) => p.low_stock_alert_enabled && p.quantity <= p.min_quantity,
  ).length;

  const run = (fn: () => Promise<unknown>) => {
    setError('');
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Boxes} label="Products" value={products.length.toString()} />
        <StatCard icon={Package} label="Inventory Value" value={money(totalValue)} />
        <StatCard
          icon={TriangleAlert}
          label="Low Stock"
          value={lowStockCount.toString()}
          tone={lowStockCount > 0 ? 'warn' : 'default'}
        />
        <StatCard icon={ClipboardList} label="Open POs" value={purchaseOrders.filter((p) => p.status !== 'received' && p.status !== 'cancelled').length.toString()} />
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts{alerts.length > 0 ? ` (${alerts.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
        </TabsList>

        {/* PRODUCTS */}
        <TabsContent value="products" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setProductOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-4" /> Add Product
            </Button>
          </div>
          {products.length === 0 ? (
            <EmptyState icon={Package} text="No products yet. Add your first item to start tracking stock." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">On Hand</TableHead>
                      <TableHead className="text-right">Reorder At</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Adjust</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => {
                      const low = p.low_stock_alert_enabled && p.quantity <= p.min_quantity;
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-medium">{p.name}</div>
                            {p.supplier_name && (
                              <div className="text-xs text-muted-foreground">{p.supplier_name}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.sku ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <span className={low ? 'font-semibold text-destructive' : ''}>
                              {p.quantity} {p.unit}
                            </span>
                            {low && (
                              <Badge variant="outline" className="ml-2 border-destructive/40 text-destructive">
                                Low
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{p.min_quantity}</TableCell>
                          <TableCell className="text-right">{money(p.cost)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="size-7"
                                disabled={isPending || p.quantity <= 0}
                                aria-label={`Remove one ${p.name}`}
                                onClick={() => run(() => adjustStock({ productId: p.id, delta: -1 }))}
                              >
                                <Minus className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="size-7"
                                disabled={isPending}
                                aria-label={`Add one ${p.name}`}
                                onClick={() => run(() => adjustStock({ productId: p.id, delta: 1 }))}
                              >
                                <Plus className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              aria-label={`Edit ${p.name}`}
                              onClick={() => {
                                setEditing(p);
                                setProductOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ALERTS */}
        <TabsContent value="alerts" className="mt-4 space-y-3">
          {alerts.length === 0 ? (
            <EmptyState icon={Check} text="No active low-stock alerts. You're fully stocked." />
          ) : (
            alerts.map((a) => (
              <Card key={a.id} className="border-destructive/30">
                <CardContent className="flex items-center gap-3 py-3">
                  <TriangleAlert className="size-5 shrink-0 text-destructive" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.alert_type === 'out_of_stock' ? 'Out of stock' : 'Low stock'} — {a.current_quantity} on hand (reorder at {a.min_quantity})
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setPoOpen(true)}>
                    Create PO
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* SUPPLIERS */}
        <TabsContent value="suppliers" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setSupplierOpen(true)}>
              <Plus className="mr-1.5 size-4" /> Add Supplier
            </Button>
          </div>
          {suppliers.length === 0 ? (
            <EmptyState icon={Truck} text="No suppliers yet. Add the vendors you order lights and hardware from." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {suppliers.map((s) => (
                <Card key={s.id}>
                  <CardContent className="py-4">
                    <p className="font-medium">{s.name}</p>
                    {s.contact_name && <p className="text-sm text-muted-foreground">{s.contact_name}</p>}
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {s.email && <p>{s.email}</p>}
                      {s.phone && <p>{s.phone}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* PURCHASE ORDERS */}
        <TabsContent value="orders" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setPoOpen(true)}>
              <Plus className="mr-1.5 size-4" /> New Purchase Order
            </Button>
          </div>
          {purchaseOrders.length === 0 ? (
            <EmptyState icon={ClipboardList} text="No purchase orders yet." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.po_number}</TableCell>
                        <TableCell>{po.supplier_name ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{po.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{money(po.total_cost)}</TableCell>
                        <TableCell className="text-right">
                          {po.status === 'draft' && (
                            <Button size="sm" variant="outline" disabled={isPending}
                              onClick={() => run(() => updatePurchaseOrderStatus({ poId: po.id, status: 'ordered' }))}>
                              Mark Ordered
                            </Button>
                          )}
                          {(po.status === 'ordered' || po.status === 'draft') && (
                            <Button size="sm" className="ml-2" disabled={isPending}
                              onClick={() => run(() => receivePurchaseOrder(po.id))}>
                              Receive
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ProductDialog
        open={productOpen}
        onOpenChange={setProductOpen}
        editing={editing}
        suppliers={suppliers}
        isPending={isPending}
        onSubmit={(payload) =>
          run(async () => {
            if (editing) await updateProduct(editing.id, payload);
            else await createProduct(payload);
            setProductOpen(false);
          })
        }
      />
      <SupplierDialog
        open={supplierOpen}
        onOpenChange={setSupplierOpen}
        isPending={isPending}
        onSubmit={(payload) =>
          run(async () => {
            await createSupplier(payload);
            setSupplierOpen(false);
          })
        }
      />
      <PurchaseOrderDialog
        open={poOpen}
        onOpenChange={setPoOpen}
        suppliers={suppliers}
        products={products}
        isPending={isPending}
        onSubmit={(payload) =>
          run(async () => {
            await createPurchaseOrder(payload);
            setPoOpen(false);
          })
        }
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`flex size-9 items-center justify-center rounded-lg ${tone === 'warn' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <Icon className="size-8 text-muted-foreground" />
        <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

// ---------- Product dialog ----------
function ProductDialog({
  open,
  onOpenChange,
  editing,
  suppliers,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Product | null;
  suppliers: Supplier[];
  isPending: boolean;
  onSubmit: (payload: any) => void;
}) {
  const [form, setForm] = useState(() => defaultProduct(editing));
  // Reset the form whenever the dialog opens for a different product.
  const [lastId, setLastId] = useState<string | null>(editing?.id ?? null);
  if (open && (editing?.id ?? null) !== lastId) {
    setForm(defaultProduct(editing));
    setLastId(editing?.id ?? null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="SKU">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <Field label="Category">
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Unit">
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="each / box / ft" />
          </Field>
          <Field label="Barcode">
            <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          </Field>
          {!editing && (
            <Field label="Starting Qty">
              <Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
          )}
          <Field label="Reorder At (min qty)">
            <Input type="number" min="0" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} />
          </Field>
          <Field label="Cost ($)">
            <Input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </Field>
          <Field label="Price ($)">
            <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Supplier" className="sm:col-span-2">
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            >
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-between sm:col-span-2">
            <Label htmlFor="low-stock-alert">Low-stock alerts</Label>
            <Switch
              id="low-stock-alert"
              checked={form.lowStockAlertEnabled}
              onCheckedChange={(v) => setForm({ ...form, lowStockAlertEnabled: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={isPending || !form.name.trim()}
            onClick={() =>
              onSubmit({
                name: form.name.trim(),
                sku: form.sku || undefined,
                barcode: form.barcode || undefined,
                category: form.category || undefined,
                unit: form.unit || 'each',
                price: parseFloat(form.price) || 0,
                cost: parseFloat(form.cost) || 0,
                quantity: parseInt(form.quantity, 10) || 0,
                minQuantity: parseInt(form.minQuantity, 10) || 0,
                supplierId: form.supplierId || null,
                lowStockAlertEnabled: form.lowStockAlertEnabled,
              })
            }
          >
            {editing ? 'Save' : 'Add Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultProduct(p: Product | null) {
  return {
    name: p?.name ?? '',
    sku: p?.sku ?? '',
    barcode: p?.barcode ?? '',
    category: p?.category ?? '',
    unit: p?.unit ?? 'each',
    price: p ? String(p.price) : '0',
    cost: p ? String(p.cost) : '0',
    quantity: p ? String(p.quantity) : '0',
    minQuantity: p ? String(p.min_quantity) : '0',
    supplierId: p?.supplier_id ?? '',
    lowStockAlertEnabled: p?.low_stock_alert_enabled ?? true,
  };
}

// ---------- Supplier dialog ----------
function SupplierDialog({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  onSubmit: (payload: any) => void;
}) {
  const [form, setForm] = useState({ name: '', contactName: '', email: '', phone: '', website: '', notes: '' });
  if (open === false && form.name !== '') {
    // no-op; keep simple
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Supplier</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Contact Name">
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={isPending || !form.name.trim()}
            onClick={() =>
              onSubmit({
                name: form.name.trim(),
                contactName: form.contactName || undefined,
                email: form.email || undefined,
                phone: form.phone || undefined,
                website: form.website || undefined,
                notes: form.notes || undefined,
              })
            }
          >
            Add Supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Purchase order dialog ----------
interface POLine {
  productId: string;
  description: string;
  quantity: string;
  unitCost: string;
}

function PurchaseOrderDialog({
  open,
  onOpenChange,
  suppliers,
  products,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suppliers: Supplier[];
  products: Product[];
  isPending: boolean;
  onSubmit: (payload: any) => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [lines, setLines] = useState<POLine[]>([{ productId: '', description: '', quantity: '1', unitCost: '0' }]);

  const setLine = (i: number, patch: Partial<POLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.unitCost) || 0) * (parseInt(l.quantity, 10) || 0), 0);
  const valid = lines.every((l) => l.description.trim() && (parseInt(l.quantity, 10) || 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier">
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Expected Date">
            <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-2">
          <Label>Items</Label>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1.6fr_1.4fr_70px_90px_32px] items-center gap-2">
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={l.productId}
                onChange={(e) => {
                  const prod = products.find((p) => p.id === e.target.value);
                  setLine(i, {
                    productId: e.target.value,
                    description: prod ? prod.name : l.description,
                    unitCost: prod ? String(prod.cost) : l.unitCost,
                  });
                }}
              >
                <option value="">Custom item</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Input
                placeholder="Description"
                value={l.description}
                onChange={(e) => setLine(i, { description: e.target.value })}
              />
              <Input
                type="number"
                min="1"
                value={l.quantity}
                onChange={(e) => setLine(i, { quantity: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={l.unitCost}
                onChange={(e) => setLine(i, { unitCost: e.target.value })}
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label="Remove line"
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
              >
                <Minus className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLines((ls) => [...ls, { productId: '', description: '', quantity: '1', unitCost: '0' }])}
          >
            <Plus className="mr-1.5 size-4" /> Add Line
          </Button>
        </div>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <span className="text-sm font-medium">Total: {money(total)}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={isPending || !valid}
              onClick={() =>
                onSubmit({
                  supplierId: supplierId || null,
                  expectedAt: expectedAt || undefined,
                  items: lines.map((l) => ({
                    productId: l.productId || null,
                    description: l.description.trim(),
                    quantity: parseInt(l.quantity, 10) || 1,
                    unitCost: parseFloat(l.unitCost) || 0,
                  })),
                })
              }
            >
              Create PO
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

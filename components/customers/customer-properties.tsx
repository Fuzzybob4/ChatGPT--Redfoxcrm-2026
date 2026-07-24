"use client";

import { useState, useTransition } from "react";
import {
  Building2, MapPin, Plus, Pencil, Trash2, Loader2,
  Star, Receipt, Wrench, Navigation,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { geocodePropertyAddress } from "@/lib/geocoding";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { CustomerProperty } from "@/lib/data";
import { useData } from "@/lib/data-context";
import { saveProperty, deleteProperty, type PropertyInput } from "@/app/(crm)/customers/actions";

interface Props {
  customerId: string;
  properties: CustomerProperty[];
}

const PROPERTY_TYPES = ["Residential", "Commercial", "HOA", "Multi-Family", "Municipal", "Other"];

const emptyForm: PropertyInput = {
  propertyName: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  propertyType: "Residential",
  isPrimary: false,
  isBillingAddress: false,
  isServiceAddress: true,
  notes: "",
};

export function CustomerProperties({ customerId, properties }: Props) {
  const { refresh } = useData();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PropertyInput>(emptyForm);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, isPrimary: properties.length === 0 });
    setError("");
    setOpen(true);
  }

  function openEdit(p: CustomerProperty) {
    setEditingId(p.id);
    setForm({
      propertyName: p.propertyName,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      propertyType: p.propertyType || "Residential",
      isPrimary: p.isPrimary,
      isBillingAddress: p.isBillingAddress,
      isServiceAddress: p.isServiceAddress,
      notes: p.notes,
    });
    setError("");
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.address.trim()) {
      setError("Street address is required.");
      return;
    }
    startTransition(async () => {
      try {
        await saveProperty(customerId, editingId, {
          ...form,
          address: form.address.trim(),
          propertyName: form.propertyName.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip: form.zip.trim(),
          notes: form.notes.trim(),
        });
        await refresh();
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save property.");
      }
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteProperty(customerId, id);
        await refresh();
      } catch {
        // no-op; surfaced via list not updating
      } finally {
        setDeletingId(null);
      }
    });
  }

  async function handleGeocode() {
    if (!form.address.trim()) {
      setError("Enter an address to geocode.");
      return;
    }
    setGeocoding(true);
    try {
      const result = await geocodePropertyAddress(
        form.address,
        form.city,
        form.state,
        form.zip
      );
      if (result) {
        setForm((f) => ({ ...f, ...result }));
        setError("");
      } else {
        setError("Address not found. Try a more complete address.");
      }
    } catch (err) {
      setError("Geocoding failed. Please try again.");
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Properties
            {properties.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({properties.length})
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Manage all service &amp; billing addresses for this customer
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={openAdd}>
          <Plus className="size-3.5" data-icon="inline-start" />
          Add Property
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {properties.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                    <MapPin className="size-4 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium hover:text-primary">
                        {p.propertyName || p.address}
                      </p>
                      {p.propertyType && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                          {p.propertyType}
                        </Badge>
                      )}
                    </div>
                    {p.propertyName && (
                      <p className="text-xs text-muted-foreground">{p.address}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {[p.city, p.state].filter(Boolean).join(", ")}
                      {p.zip ? ` ${p.zip}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.isPrimary && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-1 font-normal">
                          <Star className="size-2.5" /> Primary
                        </Badge>
                      )}
                      {p.isServiceAddress && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-1 font-normal">
                          <Wrench className="size-2.5" /> Service
                        </Badge>
                      )}
                      {p.isBillingAddress && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-1 font-normal">
                          <Receipt className="size-2.5" /> Billing
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
              <div className="flex items-start justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex-1" />
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openEdit(p)}
                    aria-label="Edit property"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(p.id)}
                    disabled={isPending && deletingId === p.id}
                    aria-label="Delete property"
                  >
                    {isPending && deletingId === p.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Building2 className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">No additional properties yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Add each building or address this customer manages. Great for property
              managers with multiple locations.
            </p>
          </div>
        )}
      </CardContent>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              {editingId ? "Edit Property" : "Add Property"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this address and its roles."
                : "Add a service or billing address for this customer."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label htmlFor="prop-name">Property Name</Label>
                <Input
                  id="prop-name"
                  value={form.propertyName}
                  onChange={(e) => setForm({ ...form, propertyName: e.target.value })}
                  placeholder="Oak Ridge Apartments"
                />
              </div>
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label htmlFor="prop-type">Type</Label>
                <Select
                  value={form.propertyType}
                  onValueChange={(v) => v && setForm({ ...form, propertyType: v })}
                >
                  <SelectTrigger id="prop-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prop-address">Street Address *</Label>
              <Input
                id="prop-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-3 space-y-1.5">
                <Label htmlFor="prop-city">City</Label>
                <Input
                  id="prop-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Austin"
                />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="prop-state">State</Label>
                <Input
                  id="prop-state"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  placeholder="TX"
                  maxLength={2}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="prop-zip">ZIP</Label>
                <Input
                  id="prop-zip"
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  placeholder="78701"
                />
              </div>
            </div>

            {/* Geocode button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGeocode}
              disabled={geocoding}
              className="w-full"
            >
              {geocoding ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  Finding coordinates...
                </>
              ) : (
                <>
                  <Navigation className="size-3.5 mr-1.5" />
                  Geocode Address
                </>
              )}
            </Button>

            {/* Role flags */}
            <div className="space-y-2.5 rounded-lg border border-border p-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={form.isPrimary}
                  onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                />
                <span className="text-sm">Primary property</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={form.isServiceAddress}
                  onChange={(e) => setForm({ ...form, isServiceAddress: e.target.checked })}
                />
                <span className="text-sm">Service address (work happens here)</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={form.isBillingAddress}
                  onChange={(e) => setForm({ ...form, isBillingAddress: e.target.checked })}
                />
                <span className="text-sm">Billing address (invoices go here)</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prop-notes">Notes</Label>
              <Textarea
                id="prop-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Gate code, access instructions, seasonal decor preferences..."
                rows={2}
                className="resize-none"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && !deletingId ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                    Saving...
                  </>
                ) : editingId ? (
                  "Save Changes"
                ) : (
                  "Add Property"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

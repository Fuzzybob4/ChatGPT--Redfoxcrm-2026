"use client";

import { useState, useTransition, useRef, KeyboardEvent } from "react";
import { Pencil, X, Plus, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { Checkbox } from "@/components/ui/checkbox";
import { updateCustomer } from "@/app/(crm)/customers/actions";
import { useData } from "@/lib/data-context";

interface CustomerForEdit {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  notes: string;
  tags: string[];
  marketingOptIn?: boolean;
}

interface Props {
  customer: CustomerForEdit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCustomerModal({ customer, open, onOpenChange }: Props) {
  const { refresh } = useData();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState(customer.address ?? "");
  const [city, setCity] = useState(customer.city ?? "");
  const [state, setState] = useState(customer.state ?? "");
  const [zip, setZip] = useState(customer.zip ?? "");
  const [status, setStatus] = useState(customer.status);
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [tags, setTags] = useState<string[]>(customer.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(customer.marketingOptIn ?? false);
  const [error, setError] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || tags.includes(tag)) return;
    setTags((prev) => [...prev, tag]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      try {
        await updateCustomer(customer.id, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
          status,
          notes: notes.trim(),
          tags,
          marketingOptIn,
        });
        await refresh();
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save changes.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" />
            Edit Customer
          </DialogTitle>
          <DialogDescription>
            Update contact details, status, tags, and notes for this customer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-1">
          {/* Name + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-address">Street Address</Label>
            <Input
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
            />
          </div>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-3 space-y-1.5">
              <Label htmlFor="edit-city">City</Label>
              <Input
                id="edit-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Austin"
              />
            </div>
            <div className="col-span-1 space-y-1.5">
              <Label htmlFor="edit-state">State</Label>
              <Input
                id="edit-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="TX"
                maxLength={2}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="edit-zip">ZIP</Label>
              <Input
                id="edit-zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="78701"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <p className="text-xs text-muted-foreground">
              Press Enter or comma to add. Tags are searchable from the customer list.
            </p>
            <div
              className="flex flex-wrap gap-1.5 min-h-10 rounded-md border border-input bg-background px-3 py-2 cursor-text"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 text-xs h-6 pl-2 pr-1 cursor-default"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                    className="text-muted-foreground hover:text-foreground rounded-full"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => addTag(tagInput)}
                placeholder={tags.length === 0 ? "installed-2026, wreaths, colored-lights…" : ""}
                className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Quick-add suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                `installed-${new Date().getFullYear()}`,
                `installed-${new Date().getFullYear() - 1}`,
                "wreaths",
                "colored-lights",
                "white-lights",
                "garland",
                "commercial",
                "vip",
              ]
                .filter((s) => !tags.includes(s))
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-input px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                  >
                    <Plus className="size-3" />
                    {s}
                  </button>
                ))}
            </div>
          </div>

          {/* Marketing opt-in */}
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              id="edit-marketing-opt-in"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-1 size-4 rounded border-input accent-primary cursor-pointer"
            />
            <div>
              <Label htmlFor="edit-marketing-opt-in" className="cursor-pointer font-medium">
                Marketing emails
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customer has opted in to receive marketing campaigns from your business. Required before including them in email campaigns.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this customer..."
              rows={3}
              className="resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

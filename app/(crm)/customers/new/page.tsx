"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { createCustomer } from "@/app/(crm)/customers/actions";
import { useData } from "@/lib/data-context";
import { useLocation } from "@/lib/location-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewCustomerPage() {
  const router = useRouter();
  const { locations, refresh } = useData();
  const { selectedLocationId } = useLocation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", city: "", state: "", zip: "", status: "active", notes: "", locationId: selectedLocationId || "" });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const id = await createCustomer({ ...form, tags: [], marketingOptIn: false, locationId: form.locationId || undefined });
        // The detail page reads from the client data provider. Refresh it before
        // navigating so the newly-created customer is available immediately.
        await refresh();
        router.push(`/customers/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to create customer.");
      }
    });
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/customers" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to customers
        </Link>
        <div className="mb-8 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-3 text-primary"><UserPlus className="size-5" /></div>
          <div><h1 className="text-2xl font-semibold tracking-tight">Add customer</h1><p className="mt-1 text-sm text-muted-foreground">Create a customer account and assign it to a location.</p></div>
        </div>
        <form onSubmit={submit} className="space-y-6 rounded-xl border bg-card p-5 shadow-sm md:p-7">
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="name">Full name *</Label><Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Jane Smith" /></div>
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="jane@example.com" /></div>
            <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(512) 555-0123" /></div>
            <div className="space-y-2"><Label htmlFor="status">Status</Label><Select value={form.status} onValueChange={(value) => value && update("status", value)}><SelectTrigger id="status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="lead">Lead</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="location">Location</Label><Select value={form.locationId || "unassigned"} onValueChange={(value) => value && update("locationId", value === "unassigned" ? "" : value)}><SelectTrigger id="location"><SelectValue placeholder="Choose a location" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="address">Street address</Label><Input id="address" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="123 Main St" /></div>
            <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Austin" /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="state">State</Label><Input id="state" maxLength={2} value={form.state} onChange={(e) => update("state", e.target.value)} placeholder="TX" /></div><div className="space-y-2"><Label htmlFor="zip">ZIP</Label><Input id="zip" value={form.zip} onChange={(e) => update("zip", e.target.value)} placeholder="78701" /></div></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Add helpful context about this customer" rows={4} /></div>
          </section>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" render={<Link href="/customers" />}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="size-4 animate-spin" />}{isPending ? "Creating..." : "Create customer"}</Button></div>
        </form>
      </div>
    </main>
  );
}

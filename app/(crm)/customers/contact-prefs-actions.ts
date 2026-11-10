"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import type { ContactPrefs } from "@/lib/contact-prefs";

export async function getContactPrefs(customerId: string): Promise<ContactPrefs> {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("customers")
    .select("do_not_contact, do_not_contact_at, do_not_contact_reason, marketing_unsubscribed, sms_opt_out")
    .eq("id", customerId)
    .eq("org_id", org.orgId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Customer not found.");
  return {
    doNotContact: Boolean(data.do_not_contact),
    doNotContactAt: data.do_not_contact_at ?? null,
    doNotContactReason: data.do_not_contact_reason ?? null,
    emailOptOut: Boolean(data.marketing_unsubscribed),
    textOptOut: Boolean(data.sms_opt_out),
  };
}

export async function saveContactPrefs(
  customerId: string,
  input: { doNotContact: boolean; reason?: string | null; emailOptOut: boolean; textOptOut: boolean },
): Promise<ContactPrefs> {
  const supabase = await createClient();
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");

  const { data: current } = await supabase
    .from("customers")
    .select("do_not_contact, do_not_contact_at")
    .eq("id", customerId)
    .eq("org_id", org.orgId)
    .single();
  if (!current) throw new Error("Customer not found.");

  const dnc = Boolean(input.doNotContact);
  const changes: Record<string, unknown> = {
    do_not_contact: dnc,
    do_not_contact_at: dnc ? current.do_not_contact_at ?? new Date().toISOString() : null,
    do_not_contact_reason: dnc ? (input.reason ?? "").trim().slice(0, 500) || null : null,
    // Do not contact covers every channel.
    marketing_unsubscribed: dnc || Boolean(input.emailOptOut),
    sms_opt_out: dnc || Boolean(input.textOptOut),
  };
  if (dnc || input.emailOptOut) changes.marketing_opt_in = false;

  const { error } = await supabase
    .from("customers")
    .update(changes)
    .eq("id", customerId)
    .eq("org_id", org.orgId);
  if (error) throw new Error(error.message);

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return getContactPrefs(customerId);
}

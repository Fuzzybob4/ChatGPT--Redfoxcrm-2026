"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { startSubscriptionForOrg } from "@/lib/billing-server";

async function ownerContext() {
  const org = await getCurrentOrg();
  if (!org) return { error: "Please sign in." as const };
  if (!["owner", "admin"].includes(org.role)) return { error: "Only the business owner can manage billing." as const };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in." as const };
  return { org, user };
}

/** Starts a secure Stripe card form for the signed-in business. */
export async function createAddCardSession(): Promise<
  { ok: true; clientSecret: string; customerId: string } | { ok: false; error: string }
> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { ok: false, error: ctx.error as string };
  const { org, user } = ctx;
  const admin = createAdminClient();
  const { data: row } = await admin.from("organizations").select("name, stripe_customer_id").eq("id", org.orgId).single();

  try {
    let customerId = row?.stripe_customer_id as string | null;
    if (customerId) {
      const existing = await stripe.customers.retrieve(customerId).catch(() => null);
      if (!existing || ("deleted" in existing && existing.deleted)) customerId = null;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: row?.name ?? undefined,
        metadata: { org_id: org.orgId },
      });
      customerId = customer.id;
      await admin.from("organizations").update({ stripe_customer_id: customerId }).eq("id", org.orgId);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.redfoxcrm.com";
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      ui_mode: "elements",
      customer: customerId,
      currency: "usd",
      return_url: `${appUrl}/billing/add-card`,
      integration_identifier: `redfox_addcard_${randomBytes(6).toString("hex")}`,
      excluded_payment_method_types: ["us_bank_account"],
    } as any);
    if (!session.client_secret) return { ok: false, error: "Could not open the secure card form." };
    return { ok: true, clientSecret: session.client_secret, customerId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not open the secure card form." };
  }
}

/** Saves the confirmed card to the business and starts monthly billing after the trial. */
export async function saveCardAndSubscribe(
  paymentMethodId: string,
): Promise<{ ok: true; trialEndsAt: string | null } | { ok: false; error: string }> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { ok: false, error: ctx.error as string };
  const { org, user } = ctx;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("organizations")
    .select("stripe_customer_id, subscription_interval, trial_ends_at")
    .eq("id", org.orgId)
    .single();
  if (!row?.stripe_customer_id) return { ok: false, error: "Please start again." };

  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    const pmCustomer = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
    if (pmCustomer !== row.stripe_customer_id) return { ok: false, error: "That card couldn't be verified." };

    await stripe.customers.update(row.stripe_customer_id, { invoice_settings: { default_payment_method: paymentMethodId } });
    await admin
      .from("organizations")
      .update({
        default_payment_method_id: paymentMethodId,
        card_brand: pm.card?.brand ?? "card",
        card_last4: pm.card?.last4 ?? null,
      })
      .eq("id", org.orgId);

    // If a subscription already exists, point it at the new card.
    const subs = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: "all", limit: 10 });
    for (const s of subs.data.filter((x) => ["active", "trialing", "past_due", "unpaid"].includes(x.status))) {
      await stripe.subscriptions.update(s.id, { default_payment_method: paymentMethodId });
    }

    const interval = row.subscription_interval === "yearly" ? "yearly" : "monthly";
    const started = await startSubscriptionForOrg(org.orgId, user.id, interval);
    if (!started.ok) return { ok: false, error: started.error };
    revalidatePath("/", "layout");
    return { ok: true, trialEndsAt: row.trial_ends_at ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the card." };
  }
}

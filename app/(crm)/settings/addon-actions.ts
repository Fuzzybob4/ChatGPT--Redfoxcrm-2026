"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { stripe } from "@/lib/stripe/server";
import { getAddon, getAddonsMonthlyCents, formatCents } from "@/lib/pricing";

interface PurchaseResult {
  ok: boolean;
  error?: string;
  activeAddons?: string[];
}

/**
 * Charges the card on file (off-session) for the selected add-ons and, on
 * success, activates them on the organization. Because we collect a payment
 * method at signup, no in-modal card entry is required.
 */
export async function purchaseAddons(addonIds: string[]): Promise<PurchaseResult> {
  try {
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Organization not found" };

    // Validate the requested add-ons against our pricing source of truth.
    const validIds = addonIds.filter((id) => getAddon(id));
    if (validIds.length === 0) {
      return { ok: false, error: "No valid add-ons selected" };
    }

    const supabase = await createClient();

    // Fetch the org's Stripe customer + saved payment method.
    const { data: orgRow, error: orgErr } = await supabase
      .from("organizations")
      .select("stripe_customer_id, default_payment_method_id, active_addons")
      .eq("id", org.orgId)
      .single();

    if (orgErr) {
      console.error("[v0] Error loading org for add-on purchase:", orgErr);
      return { ok: false, error: "Could not load your account" };
    }

    if (!orgRow?.stripe_customer_id || !orgRow?.default_payment_method_id) {
      return {
        ok: false,
        error: "No card on file. Please add a payment method in Billing first.",
      };
    }

    // Only charge for add-ons that aren't already active.
    const current: string[] = orgRow.active_addons ?? [];
    const toActivate = validIds.filter((id) => !current.includes(id));
    if (toActivate.length === 0) {
      return { ok: true, activeAddons: current };
    }

    const amountCents = getAddonsMonthlyCents(toActivate);
    const names = toActivate.map((id) => getAddon(id)!.name).join(", ");

    // Charge the card on file off-session.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: orgRow.stripe_customer_id,
      payment_method: orgRow.default_payment_method_id,
      off_session: true,
      confirm: true,
      description: `Add-ons (${names}) — ${formatCents(amountCents)}/mo for ${org.orgName}`,
      metadata: {
        org_id: org.orgId,
        addons: toActivate.join(","),
        kind: "addon",
      },
    });

    if (paymentIntent.status !== "succeeded") {
      return { ok: false, error: "Payment could not be completed" };
    }

    // Record the charge for history.
    const { error: chargeErr } = await supabase.from("subscription_charges").insert({
      org_id: org.orgId,
      kind: "addon",
      amount_cents: amountCents,
      interval: "monthly",
      description: `Add-ons: ${names}`,
      stripe_payment_intent_id: paymentIntent.id,
      status: "succeeded",
    });
    if (chargeErr) {
      console.error("[v0] Error recording add-on charge:", chargeErr);
    }

    // Activate the add-ons.
    const newActive = Array.from(new Set([...current, ...toActivate]));
    const { error: updateErr } = await supabase
      .from("organizations")
      .update({ active_addons: newActive })
      .eq("id", org.orgId);

    if (updateErr) {
      console.error("[v0] Error activating add-ons:", updateErr);
      return { ok: false, error: "Payment succeeded but activation failed. Contact support." };
    }

    return { ok: true, activeAddons: newActive };
  } catch (error) {
    // Stripe throws for declined off-session charges.
    const message =
      error instanceof Error ? error.message : "Failed to process add-on payment";
    console.error("[v0] Error purchasing add-ons:", error);
    return { ok: false, error: message };
  }
}

/** Deactivates an add-on (no proration/refund — stops at next cycle). */
export async function removeAddon(addonId: string): Promise<PurchaseResult> {
  try {
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Organization not found" };

    const supabase = await createClient();
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("active_addons")
      .eq("id", org.orgId)
      .single();

    const current: string[] = orgRow?.active_addons ?? [];
    const newActive = current.filter((id) => id !== addonId);

    const { error } = await supabase
      .from("organizations")
      .update({ active_addons: newActive })
      .eq("id", org.orgId);

    if (error) {
      console.error("[v0] Error removing add-on:", error);
      return { ok: false, error: "Failed to remove add-on" };
    }

    return { ok: true, activeAddons: newActive };
  } catch (error) {
    console.error("[v0] Error removing add-on:", error);
    return { ok: false, error: "Failed to remove add-on" };
  }
}

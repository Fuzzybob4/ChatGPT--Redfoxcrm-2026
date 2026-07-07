"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { stripe } from "@/lib/stripe/server";

const ADD_ONS = {
  recurring_services: { name: "Recurring Services", price: 2900 },
  route_optimization: { name: "Route Optimization", price: 4900 },
  portal_upsells: { name: "Customer Portal Upsells", price: 1900 },
  sms_notifications: { name: "SMS Notifications", price: 2900 },
  email_campaigns: { name: "Email Campaigns", price: 1900 },
};

export async function createAddonPaymentIntent(addonIds: string[]) {
  try {
    const org = await getCurrentOrg();
    if (!org) return { error: "Organization not found" };

    const supabase = await createClient();

    // Get or create Stripe customer
    let customerId: string = "";
    
    // Check if org already has a Stripe customer ID
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", org.orgId)
      .single();

    if (existingOrg?.stripe_customer_id) {
      customerId = existingOrg.stripe_customer_id;
    } else if (org.orgId) {
      // Create a new Stripe customer for this org if it doesn't exist
      const customer = await stripe.customers.create({
        email: "business@" + org.orgName.toLowerCase().replace(/\s+/g, "-"),
        metadata: {
          org_id: org.orgId,
          org_name: org.orgName,
        },
      });
      customerId = customer.id;

      // Store the Stripe customer ID in the org
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.orgId);
    }

    // Calculate total amount from selected add-ons
    let totalAmount = 0;
    for (const addonId of addonIds) {
      const addon = ADD_ONS[addonId as keyof typeof ADD_ONS];
      if (addon) {
        totalAmount += addon.price;
      }
    }

    if (totalAmount === 0) {
      return { error: "No valid add-ons selected" };
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "usd",
      customer: customerId,
      metadata: {
        org_id: org.orgId,
        addons: addonIds.join(","),
        type: "addon_subscription",
      },
      description: `Add-on subscription for ${org.orgName}`,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      addons: addonIds,
    };
  } catch (error) {
    console.error("[v0] Error creating addon payment intent:", error);
    return { error: "Failed to create payment intent" };
  }
}

export async function confirmAddonPayment(
  paymentIntentId: string,
  addonIds: string[]
) {
  try {
    const org = await getCurrentOrg();
    if (!org) return { error: "Organization not found" };

    const supabase = await createClient();

    // Verify payment intent status
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId
    );

    if (paymentIntent.status !== "succeeded") {
      return { error: "Payment was not successful" };
    }

    // Store the payment record
    const { error: paymentError } = await supabase
      .from("payments")
      .insert({
        org_id: org.orgId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        stripe_payment_intent_id: paymentIntentId,
        status: "succeeded",
        type: "addon_subscription",
        metadata: {
          addons: addonIds,
        },
      });

    if (paymentError) {
      console.error("[v0] Error storing payment:", paymentError);
      return { error: "Failed to record payment" };
    }

    // Update organization with active add-ons
    const activeAddons = await supabase
      .from("organizations")
      .select("active_addons")
      .eq("id", org.orgId)
      .single();

    const currentAddons = activeAddons.data?.active_addons || [];
    const newAddons = Array.from(new Set([...currentAddons, ...addonIds]));

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        active_addons: newAddons,
        updated_at: new Date().toISOString(),
      })
      .eq("id", org.orgId);

    if (updateError) {
      console.error("[v0] Error updating add-ons:", updateError);
      return { error: "Failed to activate add-ons" };
    }

    return {
      success: true,
      message: "Add-ons activated successfully",
      addons: newAddons,
    };
  } catch (error) {
    console.error("[v0] Error confirming addon payment:", error);
    return { error: "Failed to confirm payment" };
  }
}

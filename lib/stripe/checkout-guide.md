# Stripe Checkout Session Guide for Invoices

This document specifies the requirements for creating Stripe Checkout Sessions that integrate with the RedFox CRM webhook system.

## Overview

When creating a Checkout Session for an invoice payment:

1. The session must include specific metadata to link the payment back to your internal records
2. The webhook handler validates this metadata before updating the invoice
3. The amount must match the invoice total (to the cent)
4. The session is marked as completed only when `payment_status === "paid"`

## Required Metadata

Every `checkout.sessions.create()` call for an invoice must include:

```javascript
const session = await stripe.checkout.sessions.create({
  // ... other fields ...
  metadata: {
    invoice_id: invoice.id,          // UUID of the invoice in RedFox
    org_id: orgId,                   // UUID of the organization
    customer_id: invoice.customerId, // UUID of the customer
  },
  // ... rest of config ...
});
```

### Metadata Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoice_id` | UUID string | **YES** | The internal RedFox invoice ID. The webhook uses this to look up and update the invoice. |
| `org_id` | UUID string | **YES** | The organization ID. The webhook verifies that the invoice belongs to this org before updating. |
| `customer_id` | UUID string | Recommended | The customer ID for reference. While not currently used in the webhook, it's good practice to include it. |

## Webhook Validation

The webhook handler (`/api/webhooks/stripe/route.ts`) performs these checks:

1. **Metadata validation** — All required fields must be present
2. **Payment status check** — `session.payment_status` must equal `"paid"`
3. **Amount validation** — `session.amount_total` (in cents) ÷ 100 must equal the invoice's `total_amount` (within $0.01)
4. **Organization ownership** — The invoice's `org_id` must match the metadata `org_id`
5. **Invoice existence** — The invoice must exist in the database
6. **Idempotency** — If the invoice is already marked `"paid"`, the webhook skips re-updating it
7. **Event deduplication** — Duplicate webhook events (same event ID within 60 seconds) are ignored

## Complete Example

```javascript
// Inside a server action (e.g., in invoices/actions.ts)

import { stripe } from "@/lib/stripe/server";

export async function createInvoiceCheckout(invoiceId: string, orgId: string) {
  // Fetch the invoice from the database
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, total_amount, customer_id, title")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .single();

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // Create the Checkout Session with required metadata
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Invoice ${invoice.title}`,
            description: `Payment for invoice ${invoiceId}`,
          },
          unit_amount: Math.round(invoice.total_amount * 100), // Amount in cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}?status=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}?status=cancel`,
    
    // ⚠️ CRITICAL: Include metadata for webhook integration
    metadata: {
      invoice_id: invoice.id,
      org_id: orgId,
      customer_id: invoice.customer_id,
    },
    
    // Optional: also include in payment_intent_data for redundancy
    payment_intent_data: {
      metadata: {
        invoice_id: invoice.id,
        org_id: orgId,
      },
    },
  });

  // Return the session ID or URL to the client
  return session.id;
}
```

## Error Handling

If the webhook encounters a critical error, it returns HTTP 500. Stripe will automatically retry the webhook delivery multiple times according to their retry schedule. This ensures that transient database errors don't result in unpaid invoices staying unpaid in your system.

**Always check the webhook logs** (in Stripe Dashboard > Developers > Webhooks > Events) to verify that payments are being processed:

- ✅ Status `succeeded` → Invoice was successfully marked as paid
- ❌ Status `failed` → Database update failed; check logs for details

## Testing Locally

Use Stripe's CLI to test webhooks locally:

```bash
# Forward webhook events to your local dev server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Use Stripe CLI to trigger test events
stripe trigger payment_intent.succeeded
```

Then check your application logs to see the webhook being processed.

## Frequently Asked Questions

**Q: What if I don't include the metadata?**
A: The webhook will log an error and skip processing. The invoice will remain unpaid, and Stripe will retry delivery.

**Q: Can I use different metadata field names?**
A: No. The webhook strictly expects `invoice_id`, `org_id`, and optionally `customer_id`. Using different names will cause the webhook to reject the event.

**Q: What if the amount doesn't match?**
A: The webhook logs an error and returns 500. The invoice remains unpaid. Check that you're converting `total_amount` from dollars to cents correctly.

**Q: Can a user pay the same invoice twice?**
A: No. The webhook checks if the invoice is already marked `"paid"` and skips re-updating it. Stripe will still deliver the webhook for the second payment, but the CRM will ignore it.

**Q: How long are webhook events deduplicated?**
A: 60 seconds for the in-memory cache. After that, Stripe retries are assumed to be new payment attempts. For production, migrate to Redis for persistence across restarts.

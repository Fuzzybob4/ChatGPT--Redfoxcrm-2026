"use client";

import { useState } from "react";
import { useElements, useStripe, Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createAddonPaymentIntent, confirmAddonPayment } from "@/app/(crm)/settings/addon-actions";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ADD_ONS = [
  { id: "recurring_services", name: "Recurring Services", price: "$29" },
  { id: "route_optimization", name: "Route Optimization", price: "$49" },
  { id: "portal_upsells", name: "Customer Portal Upsells", price: "$19" },
  { id: "sms_notifications", name: "SMS Notifications", price: "$29" },
  { id: "email_campaigns", name: "Email Campaigns", price: "$19" },
];

interface AddonPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAddons: string[];
  onSuccess: (addons: string[]) => void;
}

function PaymentContent({
  selectedAddons,
  onOpenChange,
  onSuccess,
}: Omit<AddonPaymentModalProps, "open">) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  const totalAmount = selectedAddons.reduce((sum, addonId) => {
    const addon = ADD_ONS.find((a) => a.id === addonId);
    return sum + (addon ? parseInt(addon.price.replace(/\D/g, "")) : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      // Create payment intent
      const result = await createAddonPaymentIntent(selectedAddons);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (!result.clientSecret) {
        setError("Failed to create payment intent");
        setLoading(false);
        return;
      }

      setPaymentIntentId(result.clientSecret.split("_secret_")[0]);

      // Confirm payment with Stripe
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: result.clientSecret,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/settings?tab=addons&success=true`,
        },
      });

      if (confirmError) {
        setError(confirmError.message || "Payment failed");
        setLoading(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        // Confirm on backend
        const confirmResult = await confirmAddonPayment(
          paymentIntent.id,
          selectedAddons
        );

        if (confirmResult.error) {
          setError(confirmResult.error);
          setLoading(false);
          return;
        }

        onSuccess(selectedAddons);
        onOpenChange(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Summary */}
      <div className="space-y-3 bg-muted/40 p-4 rounded-lg">
        <p className="text-sm font-medium">Add-ons to activate:</p>
        {selectedAddons.map((addonId) => {
          const addon = ADD_ONS.find((a) => a.id === addonId);
          return (
            <div
              key={addonId}
              className="flex items-center justify-between text-sm"
            >
              <span>{addon?.name}</span>
              <span className="font-semibold">{addon?.price}/mo</span>
            </div>
          );
        })}
        <div className="border-t border-border pt-3 mt-3 flex items-center justify-between">
          <span className="font-semibold">Monthly charge:</span>
          <span className="text-lg font-bold text-primary">
            ${totalAmount}/mo
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stripe elements placeholder - in production would use PaymentElement */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Enter your card information to activate these add-ons. Billing starts immediately.
        </p>
        <div className="border border-input rounded-lg p-4 bg-background">
          <p className="text-sm text-muted-foreground text-center py-8">
            Card payment form will appear here
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1 gap-2">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${totalAmount}/month`
          )}
        </Button>
      </div>
    </form>
  );
}

export function AddonPaymentModal({
  open,
  onOpenChange,
  selectedAddons,
  onSuccess,
}: AddonPaymentModalProps) {
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof getStripe> | null>(null);

  // Load Stripe when modal opens
  if (open && !stripePromise) {
    setStripePromise(getStripe());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activate Add-Ons</DialogTitle>
          <DialogDescription>
            Add-ons are billed monthly and start immediately after payment.
          </DialogDescription>
        </DialogHeader>

        {stripePromise ? (
          <Elements stripe={stripePromise}>
            <PaymentContent
              selectedAddons={selectedAddons}
              onOpenChange={onOpenChange}
              onSuccess={onSuccess}
            />
          </Elements>
        ) : (
          <div className="py-8 text-center">
            <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { purchaseAddons } from "@/app/(crm)/settings/addon-actions";
import { AlertCircle, Loader2, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAddon, getAddonsMonthlyCents, formatCents } from "@/lib/pricing";

interface AddonPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAddons: string[];
  onSuccess: (addons: string[]) => void;
  cardBrand?: string | null;
  cardLast4?: string | null;
}

export function AddonPaymentModal({
  open,
  onOpenChange,
  selectedAddons,
  onSuccess,
  cardBrand,
  cardLast4,
}: AddonPaymentModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCents = getAddonsMonthlyCents(selectedAddons);
  const hasCard = Boolean(cardLast4);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await purchaseAddons(selectedAddons);
      if (!result.ok) {
        setError(result.error ?? "Payment failed");
        setLoading(false);
        return;
      }
      onSuccess(result.activeAddons ?? selectedAddons);
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activate Add-Ons</DialogTitle>
          <DialogDescription>
            Add-ons are billed monthly and start immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Summary */}
          <div className="space-y-3 bg-muted/40 p-4 rounded-lg">
            <p className="text-sm font-medium">Add-ons to activate:</p>
            {selectedAddons.map((addonId) => {
              const addon = getAddon(addonId);
              if (!addon) return null;
              return (
                <div key={addonId} className="flex items-center justify-between text-sm">
                  <span>{addon.name}</span>
                  <span className="font-semibold">{formatCents(addon.monthlyCents)}/mo</span>
                </div>
              );
            })}
            <div className="border-t border-border pt-3 mt-3 flex items-center justify-between">
              <span className="font-semibold">Charged today:</span>
              <span className="text-lg font-bold text-primary">
                {formatCents(totalCents)}/mo
              </span>
            </div>
          </div>

          {/* Card on file */}
          {hasCard ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <CreditCard className="size-5 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium capitalize">
                  {cardBrand ?? "Card"} ending in {cardLast4}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your card on file will be charged now.
                </p>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                No card on file.{" "}
                <Link href="/billing" className="font-medium underline">
                  Add a payment method
                </Link>{" "}
                to activate add-ons.
              </AlertDescription>
            </Alert>
          )}

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !hasCard}
              className="flex-1 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${formatCents(totalCents)}/month`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

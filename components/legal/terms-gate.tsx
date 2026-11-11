"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { acceptTerms } from "@/app/(crm)/legal/actions";

/** Full-screen notice asking the business owner to accept updated Terms. */
export function TermsGate() {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-xl font-bold text-foreground">We updated our Terms and Privacy Policy</h2>
        <p className="mt-2 text-sm text-muted-foreground">Please review and accept to keep using RedFox. The main points:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-foreground">
          <li>You own your data. We don&apos;t sell it, hand out your customer lists, or market to your customers.</li>
          <li>
            We may combine de-identified data across many businesses, like average job value by region or installs per
            season, to improve RedFox and publish industry benchmarks. It never identifies your business or anyone in it.
          </li>
          <li>Clear billing: 30-day trial, cancel anytime, 30 days&apos; notice before price changes.</li>
          <li>You can export your data for 30 days after cancelling.</li>
        </ul>
        <p className="mt-3 text-sm">
          <a href="/landing/terms" target="_blank" className="text-primary underline">Terms of Service</a>
          {" · "}
          <a href="/landing/privacy" target="_blank" className="text-primary underline">Privacy Policy</a>
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
          <span>I have read and agree to the Terms of Service and Privacy Policy on behalf of my business.</span>
        </label>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <Button
          className="mt-4 w-full"
          disabled={!checked || pending}
          onClick={() =>
            start(async () => {
              const r = await acceptTerms();
              if ("error" in r) setError(r.error);
              else router.refresh();
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          I agree
        </Button>
      </div>
    </div>
  );
}

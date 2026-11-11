"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enrollContract } from "./actions";

export function PlanSignup({ token, invoiceId, business, years }: { token: string; invoiceId: string; business: string; years: number }) {
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <p>You&apos;re signed up! Your first invoice from {business} will arrive within a day. Thank you!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input placeholder="Type your full name to sign" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I agree to a {years}-year holiday lighting plan with {business}, billed monthly as shown above.
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        className="h-12 w-full text-base font-semibold"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await enrollContract(token, invoiceId, { name, agreed });
            if (!r.ok) return setError(r.error);
            setDone(true);
          })
        }
      >
        {pending ? "Signing up…" : `Sign up for the ${years}-year plan`}
      </Button>
    </div>
  );
}

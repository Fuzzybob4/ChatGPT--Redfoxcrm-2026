import { createClient } from "@/lib/supabase/server";
import { CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; org?: string }>;
}) {
  const { email, org } = await searchParams;
  let success = false;
  let message = "";

  if (email && org) {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("customers")
        .update({
          marketing_unsubscribed: true,
          marketing_opt_in: false,
        })
        .eq("email", email)
        .eq("org_id", org);

      if (error) throw error;
      success = true;
      message = `${email} has been unsubscribed.`;
    } catch {
      message = "We could not process your unsubscribe request. Please contact us directly.";
    }
  } else {
    message = "Invalid unsubscribe link.";
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-4">
        {success ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 mx-auto">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </span>
            <h1 className="text-xl font-semibold">You&apos;re unsubscribed</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
            <p className="text-muted-foreground text-sm">
              You will no longer receive marketing emails from this business.
              Transactional emails (invoices, confirmations) are not affected.
            </p>
          </>
        ) : (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-red-100 mx-auto">
              <XCircle className="size-7 text-red-600" />
            </span>
            <h1 className="text-xl font-semibold">Could not unsubscribe</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
          </>
        )}
      </div>
    </main>
  );
}

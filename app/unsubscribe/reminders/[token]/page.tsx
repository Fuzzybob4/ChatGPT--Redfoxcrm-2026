import { CheckCircle2, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment reminders", robots: { index: false, follow: false } };

export default async function ReminderUnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let ok = false;
  let business = "this business";

  if (token && token.length >= 20) {
    const db = createAdminClient();
    const { data: customer } = await db
      .from("customers")
      .select("id, org_id")
      .eq("portal_access_token", token)
      .maybeSingle();
    if (customer) {
      const { error } = await db
        .from("customers")
        .update({ invoice_reminders_opt_out: true })
        .eq("id", customer.id)
        .eq("org_id", customer.org_id);
      ok = !error;
      const { data: profile } = await db
        .from("business_profiles")
        .select("business_name")
        .eq("org_id", customer.org_id)
        .maybeSingle();
      if (profile?.business_name) business = profile.business_name;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="max-w-sm rounded-xl border bg-background p-8 text-center shadow-sm">
        {ok ? (
          <>
            <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-600" />
            <h1 className="text-lg font-semibold">Reminders turned off</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You won&apos;t get automatic payment reminders from {business}. You&apos;ll still receive invoices and
              receipts.
            </p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto mb-3 size-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Link not valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">This link has expired. Reply to any email from the business to stop reminders.</p>
          </>
        )}
      </div>
    </div>
  );
}

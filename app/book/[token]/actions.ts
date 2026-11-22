"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPortalToken } from "@/app/(crm)/customers/portal-actions";
import { bookReturningCustomer } from "@/lib/rebooking";
import { createNotification } from "@/lib/notifications-server";

export async function bookMyInstall(
  token: string,
  day: string,
  half: "am" | "pm",
): Promise<{ ok: true } | { error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || (half !== "am" && half !== "pm")) return { error: "Pick a day and a time." };
  const customer = await verifyPortalToken(token);
  if (!customer) return { error: "This link isn't valid anymore. Please call or text us." };
  const db = createAdminClient();
  const r = await bookReturningCustomer(db, customer.org_id, customer.id, day, half);
  if ("error" in r) return r;

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "A customer";
  const when = `${new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${half === "am" ? "morning" : "afternoon"}`;
  try {
    await createNotification({
      orgId: customer.org_id,
      type: "online_booking",
      title: `Booked online: ${name}`,
      message: `${name} picked ${when} for their install.`,
      relatedId: r.jobId,
      customerId: customer.id,
    });
  } catch {
    // The booking is saved; the alert is best effort.
  }
  try {
    if (customer.email) {
      const { getBusinessSender, renderEmail } = await import("@/lib/email/transactional");
      const { isEmailConfigured, sendEmail } = await import("@/lib/email/resend");
      if (isEmailConfigured()) {
        const business = await getBusinessSender(db, customer.org_id);
        await sendEmail({
          to: customer.email,
          subject: `You're booked: ${when}`,
          fromName: business.name,
          replyTo: business.email,
          html: renderEmail({
            business,
            greeting: `Hi ${customer.first_name || "there"},`,
            paragraphs: [
              `You're on our install schedule for ${when}. We'll reach out before we arrive.`,
              "Need a different day? Just reply to this email or give us a call.",
            ],
          }),
        });
      }
    }
  } catch {
    // Confirmation email is best effort.
  }
  return { ok: true };
}

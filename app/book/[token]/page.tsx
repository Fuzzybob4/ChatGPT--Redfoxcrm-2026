import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPortalToken } from "@/app/(crm)/customers/portal-actions";
import { existingBooking, loadRebookSettings, openDays, returningKind } from "@/lib/rebooking";
import { getBusinessSender } from "@/lib/email/transactional";
import { BookingClient } from "./booking-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book your install", robots: { index: false } };

export default async function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await verifyPortalToken(token);
  if (!customer) notFound();
  const db = createAdminClient();
  const [settings, kind, business] = await Promise.all([
    loadRebookSettings(db, customer.org_id),
    returningKind(db, customer.org_id, customer.id),
    getBusinessSender(db, customer.org_id),
  ]);
  const booked = await existingBooking(db, customer.org_id, customer.id, settings);
  const days = settings.enabled && kind && !booked ? await openDays(db, customer.org_id, settings) : [];

  let state: "open" | "closed" | "not_returning" | "booked" | "full" = "open";
  if (booked) state = "booked";
  else if (!settings.enabled) state = "closed";
  else if (!kind) state = "not_returning";
  else if (!days.length) state = "full";

  return (
    <BookingClient
      token={token}
      firstName={customer.first_name ?? ""}
      business={{ name: business.name, phone: business.phone, email: business.email }}
      state={state}
      bookedDay={booked?.scheduled_date ?? null}
      bookedHalf={booked ? (String(booked.start_time ?? "08:00") < "12:00" ? "am" : "pm") : null}
      days={days}
    />
  );
}

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsFromRow } from "@/lib/quotes/pricing";
import { InstantQuoteClient } from "./instant-quote-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Instant holiday lighting quote" };

export default async function InstantQuotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createAdminClient();
  const { data: row } = await db.from("instant_quote_settings").select("*").eq("slug", slug).maybeSingle();
  if (!row || !row.enabled) notFound();
  const [{ data: profile }, { data: org }] = await Promise.all([
    db.from("business_profiles").select("business_name, phone, email").eq("org_id", row.org_id).maybeSingle(),
    db.from("organizations").select("name").eq("id", row.org_id).maybeSingle(),
  ]);
  return (
    <InstantQuoteClient
      slug={slug}
      settings={settingsFromRow(row)}
      business={{ name: profile?.business_name || org?.name || "Holiday lighting", phone: profile?.phone ?? null, email: profile?.email ?? null }}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
    />
  );
}

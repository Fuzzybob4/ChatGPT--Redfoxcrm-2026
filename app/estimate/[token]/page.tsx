import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadEstimateItems } from "@/lib/estimates/approval";
import { isStaffOf, readImages } from "@/lib/estimates/images";
import { EstimateApprovalClient } from "./estimate-approval-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your estimate",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicEstimatePage({ params }: Props) {
  const { token } = await params;
  if (!token || token.length < 20) notFound();

  const db = createAdminClient();
  const { data: estimate } = await db
    .from("estimates")
    .select(
      "id, org_id, customer_id, estimate_number, title, description, subtotal, tax_rate, tax_amount, total_amount, deposit_percent, valid_until, created_at, status, approved_at, approved_by_name, declined_at, viewed_at, view_count, invoice_id, images, property_id",
    )
    .eq("approval_token", token)
    .maybeSingle();
  if (!estimate) notFound();

  const [{ data: profile }, { data: org }, { data: customer }] = await Promise.all([
    db.from("business_profiles").select("business_name, phone, email, website").eq("org_id", estimate.org_id).maybeSingle(),
    db.from("organizations").select("name").eq("id", estimate.org_id).maybeSingle(),
    db
      .from("customers")
      .select("first_name, last_name, full_name, address, city, state, zip_code")
      .eq("id", estimate.customer_id)
      .eq("org_id", estimate.org_id)
      .maybeSingle(),
  ]);

  // Let the business see that the customer opened it. The owner previewing
  // their own link (signed in to the business) doesn't count as a view.
  if (!(await isStaffOf(estimate.org_id))) {
    const now = new Date().toISOString();
    await db
      .from("estimates")
      .update({
        viewed_at: estimate.viewed_at ?? now,
        last_viewed_at: now,
        view_count: Number((estimate as any).view_count ?? 0) + 1,
      })
      .eq("id", estimate.id);
  }
  const imageCount = readImages((estimate as any).images).length;
  const { propertyAddress } = await import("@/lib/properties");
  const place = await propertyAddress(db, estimate.org_id, (estimate as any).property_id);

  const items = await loadEstimateItems(db, estimate.id, estimate.org_id);
  const total = Number(estimate.total_amount ?? 0) || Number(estimate.subtotal ?? 0);
  const depositPercent = Number(estimate.deposit_percent ?? 0);

  return (
    <EstimateApprovalClient
      token={token}
      imageCount={imageCount}
      business={{
        name: profile?.business_name || org?.name || "Your contractor",
        phone: profile?.phone ?? null,
        email: profile?.email ?? null,
      }}
      customer={{
        name:
          customer?.full_name?.trim() ||
          `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() ||
          "Customer",
        address: place?.address || [customer?.address, customer?.city, customer?.state, customer?.zip_code].filter(Boolean).join(", "),
      }}
      estimate={{
        number: estimate.estimate_number ?? "",
        title: estimate.title || "Estimate",
        description: estimate.description,
        // Notes are the business's own (internal); the customer sees the description.
        notes: null,
        subtotal: Number(estimate.subtotal ?? 0) || total,
        taxAmount: Number(estimate.tax_amount ?? 0),
        total,
        depositPercent,
        depositAmount: Math.round(total * depositPercent) / 100,
        validUntil: estimate.valid_until,
        createdAt: estimate.created_at,
        approvedAt: estimate.approved_at,
        approvedByName: estimate.approved_by_name,
        declinedAt: estimate.declined_at,
        taxRate: Number(estimate.tax_rate ?? 0),
      }}
      items={items.map((i) => ({
        id: i.id,
        hasImage: Boolean(i.image_path),
        description: i.description,
        quantity: Number(i.quantity ?? 1),
        lineTotal: Number(i.line_total ?? 0),
        optional: i.optional,
        selected: i.selected,
      }))}
    />
  );
}

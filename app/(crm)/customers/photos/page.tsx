import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { PhotoGallery, type GalleryPhoto } from "@/components/customers/photo-gallery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Photo gallery - RedFox CRM" };

const PAGE = 60;
const RANGES: Record<string, number | null> = { "7": 7, "30": 30, "90": 90, all: null };

export default async function PhotoGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; q?: string; page?: string }>;
}) {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");
  if (!["owner", "admin", "manager"].includes(String(org.role ?? "").toLowerCase())) redirect("/dashboard");
  const { range: rangeParam, q: qParam, page: pageParam } = await searchParams;
  const range = rangeParam && rangeParam in RANGES ? rangeParam : "30";
  const q = (qParam ?? "").trim();
  const page = Math.max(0, Number(pageParam) || 0);
  const db = createAdminClient();

  // Customer name search narrows to matching customers first.
  let customerIds: string[] | null = null;
  if (q) {
    const { data } = await db
      .from("customers")
      .select("id")
      .eq("org_id", org.orgId)
      .or(`full_name.ilike.%${q.replace(/[%,()]/g, "")}%,address.ilike.%${q.replace(/[%,()]/g, "")}%,city.ilike.%${q.replace(/[%,()]/g, "")}%`)
      .limit(500);
    customerIds = (data ?? []).map((c) => c.id as string);
  }
  const sinceIso = RANGES[range] ? new Date(Date.now() - RANGES[range]! * 86_400_000).toISOString() : null;

  const fetchTable = async (table: "property_photos" | "customer_photos") => {
    if (customerIds && !customerIds.length) return [] as any[];
    let query = db
      .from(table)
      .select("id, customer_id, uploaded_by, photo_url, photo_type, description, created_at")
      .eq("org_id", org.orgId)
      .order("created_at", { ascending: false })
      .range(0, (page + 1) * PAGE);
    if (sinceIso) query = query.gte("created_at", sinceIso);
    if (customerIds) query = query.in("customer_id", customerIds);
    const { data } = await query;
    return (data ?? []).map((r: any) => ({ ...r, table }));
  };
  const [a, b] = await Promise.all([fetchTable("property_photos"), fetchTable("customer_photos")]);
  const merged = [...a, ...b].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
  const slice = merged.slice(page * PAGE, (page + 1) * PAGE);
  const hasMore = merged.length > (page + 1) * PAGE;

  const custIds = [...new Set(slice.map((p) => p.customer_id).filter(Boolean))];
  const userIds = [...new Set(slice.map((p) => p.uploaded_by).filter(Boolean))];
  const [{ data: customers }, { data: emps }] = await Promise.all([
    custIds.length
      ? db.from("customers").select("id, full_name, first_name, last_name, address, city").in("id", custIds)
      : Promise.resolve({ data: [] as any[] }),
    userIds.length
      ? db.from("employees").select("user_id, first_name, full_name").eq("org_id", org.orgId).in("user_id", userIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const cust = new Map((customers ?? []).map((c: any) => [c.id, c]));
  const who = new Map((emps ?? []).map((e: any) => [e.user_id, e.first_name || e.full_name]));

  const photos: GalleryPhoto[] = slice.map((p) => {
    const c: any = cust.get(p.customer_id);
    return {
      id: `${p.table}:${p.id}`,
      src: `/api/file/photo?pathname=${encodeURIComponent(p.photo_url)}`,
      customerId: p.customer_id ?? null,
      customerName: c ? c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Customer" : "Unknown customer",
      place: c ? [c.address, c.city].filter(Boolean).join(", ") : "",
      caption: p.description ?? "",
      takenBy: who.get(p.uploaded_by) ?? null,
      takenAt: p.created_at,
    };
  });

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader title="Photo gallery" description="Every photo crews take, newest first. Tap one to look closer or set up a service call." />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <PhotoGallery photos={photos} range={range} q={q} page={page} hasMore={hasMore} />
      </div>
    </div>
  );
}

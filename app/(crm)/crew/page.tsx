import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { CrewList, type CrewMember } from "@/components/crew/crew-list";

export const metadata = {
  title: "Crew - RedFox CRM",
};

export const dynamic = "force-dynamic";

export default async function CrewPage() {
  const supabase = await createClient();
  const org = await getCurrentOrg();

  // Never fall back to every organization's rows when the caller has no membership.
  const { data: employees, error } = org
    ? await supabase
        .from("employees")
        .select(
          "id, full_name, first_name, last_name, email, phone, position, role, crew_name, is_active, can_access_work_orders, can_access_mapping, created_at, user_id, invited_at, invite_accepted_at, profile_completed"
        )
        .eq("org_id", org.orgId)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (error) console.error("[crew] employees query failed", error.message);

  // Invited rows are created with is_active=false, and the list used to show
  // only active rows, so pending invites never appeared.
  const members: CrewMember[] = (employees ?? []).map((e) => ({
    id: e.id,
    name: e.full_name || `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() || e.email || "",
    status: e.is_active
      ? "active"
      : e.invited_at && !e.invite_accepted_at && !e.user_id
        ? "invited"
        : e.invited_at && !e.profile_completed
          ? "setup"
          : "inactive",
    email: e.email ?? "",
    phone: e.phone ?? "",
    position: e.position || e.role || "",
    crewName: e.crew_name ?? "",
    isActive: e.is_active ?? true,
    canWorkOrders: e.can_access_work_orders ?? false,
    canMapping: e.can_access_mapping ?? false,
  }));

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Crew"
        description="Add employees and control their access to work orders and mapping."
      />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <CrewList members={members} />
      </div>
    </div>
  );
}

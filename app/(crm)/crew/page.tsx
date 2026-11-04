import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CrewList, type CrewMember } from "@/components/crew/crew-list";

export const metadata = {
  title: "Crew - RedFox CRM",
};

export const dynamic = "force-dynamic";

export default async function CrewPage() {
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select(
      "id, full_name, first_name, last_name, email, phone, position, role, crew_name, is_active, can_access_work_orders, can_access_mapping, created_at, user_id, invited_at, invite_accepted_at"
    )
    .order("created_at", { ascending: true });

  const members: CrewMember[] = (employees ?? []).map((e) => ({
    id: e.id,
    name: (e.full_name || `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim()) || (e.email ?? "Invited employee"),
    firstName: e.first_name || (e.full_name ?? "").split(" ")[0] || "",
    lastName: e.last_name || (e.full_name ?? "").split(" ").slice(1).join(" ") || "",
    role: e.role ?? "technician",
    email: e.email ?? "",
    loginStatus: e.user_id ? "active" : e.invited_at ? "invited" : "none",
    // Invited employees haven't finished setup yet, but should still be listed.
    isActive: (e.is_active ?? true) || (!!e.invited_at && !e.invite_accepted_at),
    phone: e.phone ?? "",
    position: e.position ?? "",
    crewName: e.crew_name ?? "",
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

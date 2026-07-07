import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { SettingsContent } from "@/components/settings/settings-content";
import {
  Building,
  Zap,
  CreditCard,
  Mail,
  Bell,
  BookOpen,
  Lock,
  Package,
  ChevronRight,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";

export default async function SettingsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const supabase = await createClient();

  // Fetch business profile data
  const { data: businessProfile, error: bpError } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("org_id", org.orgId)
    .maybeSingle();

  if (bpError) {
    console.error("[v0] Error fetching business profile:", bpError);
  }

  // Fetch organization data for integrations
  const { data: orgData, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", org.orgId)
    .single();

  if (orgError) {
    console.error("[v0] Error fetching org data:", orgError);
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Settings"
        description="Manage your business information, integrations, and preferences"
      />

      <div className="flex-1 overflow-y-auto">
        <SettingsContent
          businessProfile={businessProfile}
          orgData={orgData}
          orgId={org.orgId}
        />
      </div>
    </div>
  );
}

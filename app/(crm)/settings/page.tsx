import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HubspotStatus } from "@/components/settings/hubspot-integration";
import { getCurrentOrg } from "@/lib/org";
import { SettingsContent } from "@/components/settings/settings-content";
import { PageHeader } from "@/components/page-header";

export const maxDuration = 300;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; hubspot?: string }>;
}) {
  const { tab, hubspot } = await searchParams;
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

  // Integration status (tokens never leave the server; only display fields are passed down).
  const { data: hubspotRow } = await createAdminClient()
    .from("org_integrations")
    .select("status, external_account_name, last_sync_at, last_sync_result")
    .eq("org_id", org.orgId)
    .eq("provider", "hubspot")
    .maybeSingle();
  const hubspotStatus = {
    connected: Boolean(hubspotRow),
    accountName: hubspotRow?.external_account_name ?? null,
    lastSyncAt: hubspotRow?.last_sync_at ?? null,
    lastSyncResult: (hubspotRow?.last_sync_result as HubspotStatus["lastSyncResult"]) ?? null,
  };

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
          hubspotStatus={hubspotStatus}
          hubspotCallback={hubspot ?? null}
          initialTab={tab ?? (hubspot ? "integrations" : undefined)}
        />
      </div>
    </div>
  );
}

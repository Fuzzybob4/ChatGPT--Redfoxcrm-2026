import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HubspotStatus } from "@/components/settings/hubspot-integration";
import type { SquareStatus } from "@/components/settings/square-integration";
import { getCurrentOrg } from "@/lib/org";
import { settingsFromRow } from "@/lib/quotes/pricing";
import { SettingsContent } from "@/components/settings/settings-content";
import { PageHeader } from "@/components/page-header";
import { loadBusinessRules } from "@/lib/schedule-server";

export const maxDuration = 300;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; hubspot?: string; square?: string }>;
}) {
  const { tab, hubspot, square } = await searchParams;
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
  const { data: integrationRows } = await createAdminClient()
    .from("org_integrations")
    .select("provider, status, external_account_name, last_sync_at, last_sync_result")
    .eq("org_id", org.orgId);
  const hubspotRow = (integrationRows ?? []).find((r) => r.provider === "hubspot") ?? null;
  const squareRow = (integrationRows ?? []).find((r) => r.provider === "square") ?? null;
  const squareStatus = {
    connected: Boolean(squareRow),
    accountName: squareRow?.external_account_name ?? null,
    lastSyncAt: squareRow?.last_sync_at ?? null,
    lastSyncResult: (squareRow?.last_sync_result as SquareStatus["lastSyncResult"]) ?? null,
  };
  const hubspotStatus = {
    connected: Boolean(hubspotRow),
    accountName: hubspotRow?.external_account_name ?? null,
    lastSyncAt: hubspotRow?.last_sync_at ?? null,
    lastSyncResult: (hubspotRow?.last_sync_result as HubspotStatus["lastSyncResult"]) ?? null,
  };

  const { data: quoteRow } = await createAdminClient()
    .from("instant_quote_settings")
    .select("*")
    .eq("org_id", org.orgId)
    .maybeSingle();
  const quoteSuggestedSlug = String(businessProfile?.business_name || org.businessName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const rules = await loadBusinessRules(createAdminClient(), org.orgId);
  const businessRules = {
    timezone: rules.timezone,
    seasonStartMonth: rules.seasonStartMonth,
    seasonStartDay: rules.seasonStartDay,
    daySlots: rules.daySlots,
    sizePoints: rules.sizePoints,
    crewHidePrices: rules.crewHidePrices,
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
          squareStatus={squareStatus}
          squareCallback={square ?? null}
          quoteSettings={quoteRow ? settingsFromRow(quoteRow) : null}
          quoteSuggestedSlug={quoteSuggestedSlug}
          mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
          initialTab={tab ?? (hubspot || square ? "integrations" : undefined)}
          businessRules={businessRules}
          canEditRules={["owner", "admin"].includes(String(org.role ?? "").toLowerCase())}
        />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { after } from "next/server";
import { maybeAutoSyncHubspot } from "@/lib/integrations/hubspot-sync";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LocationProvider } from "@/lib/location-context";
import { DataProvider } from "@/lib/data-context";
import { OrgProvider } from "@/lib/org-context";
import { getCurrentOrg } from "@/lib/org";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg();
  // Brand-new business with no organization yet → send to onboarding.
  if (!org) redirect("/onboarding");
  // Field crew use the mobile job app, not the office CRM.
  if (org.role === "crew") redirect("/field");

  // Keep connected integrations fresh without anyone pressing "Sync now".
  // Runs after the response is sent, so it never slows the page down.
  after(() => maybeAutoSyncHubspot(org.orgId));

  return (
    <OrgProvider org={org}>
      <DataProvider>
        <LocationProvider>
          <SidebarProvider defaultOpen>
            <div className="flex min-h-screen w-full">
              <AppSidebar />
              <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
                {children}
              </main>
            </div>
            <SubscriptionGate
              plan={org.plan}
              trialEndsAt={org.trialEndsAt}
              subscriptionStatus={org.subscriptionStatus}
              cardBrand={org.cardBrand}
              cardLast4={org.cardLast4}
            />
          </SidebarProvider>
        </LocationProvider>
      </DataProvider>
    </OrgProvider>
  );
}

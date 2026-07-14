import { Suspense } from "react";
import { getCampaigns, getOptInStats, getEmailSettings } from "./actions";
import { EmailMarketingClient } from "./email-marketing-client";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Email Marketing - RedFox CRM" };
export const dynamic = "force-dynamic";

export default async function EmailMarketingPage() {
  const [campaigns, optInStats, settings] = await Promise.all([
    getCampaigns(),
    getOptInStats(),
    getEmailSettings(),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Email Marketing"
        description="Create campaigns, manage your contact list, and track engagement."
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Suspense fallback={null}>
          <EmailMarketingClient
            campaigns={campaigns}
            optInStats={optInStats}
            settings={settings}
          />
        </Suspense>
      </div>
    </div>
  );
}

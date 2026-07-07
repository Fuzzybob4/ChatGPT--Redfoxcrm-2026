import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LocationProvider } from "@/lib/location-context";
import { DataProvider } from "@/lib/data-context";
import { OrgProvider } from "@/lib/org-context";
import { getCurrentOrg } from "@/lib/org";

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg();
  // Brand-new business with no organization yet → send to onboarding.
  if (!org) redirect("/onboarding");

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
          </SidebarProvider>
        </LocationProvider>
      </DataProvider>
    </OrgProvider>
  );
}

'use client';

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LocationProvider } from "@/lib/location-context";

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
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
  );
}

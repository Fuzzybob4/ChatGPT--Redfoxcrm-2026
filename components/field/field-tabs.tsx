"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Clock, Map as MapIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/field", label: "My jobs", icon: ClipboardList, match: (p: string) => p === "/field", leadOnly: false },
  { href: "/field/map", label: "Map", icon: MapIcon, match: (p: string) => p.startsWith("/field/map"), leadOnly: false },
  { href: "/field/hours", label: "My hours", icon: Clock, match: (p: string) => p.startsWith("/field/hours"), leadOnly: false },
  { href: "/field/customers", label: "Customers", icon: Users, match: (p: string) => p.startsWith("/field/customers"), leadOnly: false },
];

/** Bottom navigation for the crew app. Hidden on job and work order screens, which own the bottom bar. */
export function FieldTabs({ showHomes }: { showHomes: boolean }) {
  const pathname = usePathname();
  if (pathname.startsWith("/field/jobs/") || pathname.startsWith("/field/work-orders/")) return null;

  return (
    <>
      <div aria-hidden="true" className="h-16 shrink-0 pb-[env(safe-area-inset-bottom)]" />
      <nav
        aria-label="Field app"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85"
      >
        <ul className="mx-auto flex h-16 max-w-2xl items-stretch">
          {TABS.filter((tab) => showHomes || !tab.leadOnly).map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="flex flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

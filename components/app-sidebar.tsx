import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  Settings,
  ChevronDown,
  Map,
  HardHat,
  Clock,
  BarChart3,
  Receipt,
  Mail,
  Building,
  Truck,
  Package,
  LifeBuoy,
  CalendarCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SignOutMenuItem } from "@/components/sign-out-menu-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Multi-Location",
    href: "/dashboard/multi-location",
    icon: Building,
    enterprise: true,
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    badge: true,
    children: [
      {
        title: "Rebooking",
        href: "/customers/rebook",
        icon: CalendarCheck,
      },
    ],
  },
  {
    title: "Estimates",
    href: "/estimates",
    icon: FileText,
    badge: true,
    children: [
      {
        title: "Invoices",
        href: "/invoices",
        icon: Receipt,
      },
    ],
  },
  {
    title: "Jobs & Schedule",
    href: "/jobs",
    icon: CalendarDays,
    badge: true,
    children: [
      {
        title: "Crew Schedule",
        href: "/schedule",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "Trouble Calls",
    href: "/tickets",
    icon: LifeBuoy,
    badge: true,
  },
  {
    title: "Mapping",
    href: "/mapping",
    icon: Map,
  },
  {
    title: "Crew",
    href: "/crew",
    icon: HardHat,
    children: [
      {
        title: "Timesheets",
        href: "/timesheets",
        icon: Clock,
      },
    ],
  },
  {
    title: "Fleet Management",
    href: "/fleet",
    icon: Truck,
    addonRequired: "fleet_management",
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    badge: true,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "Email Marketing",
    href: "/email-marketing",
    icon: Mail,
    comingSoon: true,
  },
];

export async function AppSidebar() {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sidebar numbers follow one rule: they count things that need attention,
  // and they're hidden at zero. (A total like "2,662 customers" isn't shown.)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const [estimatesRes, invoicesRes, jobsRes, troubleRes, ticketRes, alertRes] = await Promise.all([
    // Estimates waiting on a decision (draft or sent, not approved/declined).
    supabase
      .from("estimates")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.orgId)
      .is("approved_at", null)
      .is("declined_at", null)
      .is("invoice_id", null)
      .is("archived_at", null),
    // Invoices with money still owed.
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.orgId)
      .gt("balance_due", 0)
      .not("status", "in", "(draft,cancelled,void)")
      .or("archived.is.null,archived.eq.false"),
    // Jobs on today's schedule that aren't finished.
    supabase
      .from("scheduled_jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.orgId)
      .eq("scheduled_date", today)
      .is("archived_at", null)
      .not("status", "in", "(cancelled,completed)"),
    supabase
      .from("work_order_requests")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.orgId)
      .in("status", ["new", "scheduled"]),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.orgId)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("inventory_alerts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.orgId)
      .eq("is_resolved", false),
  ]);

  const openRequests = (troubleRes.count ?? 0) + (ticketRes.count ?? 0);
  const asBadge = (n: number | null | undefined) => (n && n > 0 ? (n > 99 ? "99+" : String(n)) : "");
  const badgeHint: Record<string, string> = {
    "/estimates": "waiting on the customer",
    "/invoices": "unpaid",
    "/jobs": "today",
    "/tickets": "open",
    "/inventory": "low-stock alerts",
  };

  const badgeCounts: Record<string, string> = {
    "/estimates": asBadge(estimatesRes.count),
    "/invoices": asBadge(invoicesRes.count),
    "/jobs": asBadge(jobsRes.count),
    "/tickets": asBadge(openRequests),
    "/inventory": asBadge(alertRes.count),
  };

  const userEmail = user?.email ?? "";
  const userInitials = (org.businessName || user?.email || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar className="border-r-0">
      {/* Brand */}
      <SidebarHeader className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            RF
          </span>
          <span className="font-semibold text-sidebar-foreground text-base leading-none">
            RedFox CRM
          </span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-widest text-[10px]">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item: any) => {
                // Skip enterprise-only items if not enterprise
                if (item.enterprise && !org.isEnterprise) {
                  return null;
                }
                const addonActive = item.addonRequired
                  ? org.addonIds.includes(item.addonRequired)
                  : true;
                const locked = item.addonRequired && !addonActive;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={locked ? <span /> : <Link href={item.href} />}
                      className={cn(
                        "gap-3 text-sidebar-foreground/80 hover:text-sidebar-foreground",
                        locked && "opacity-50 cursor-default pointer-events-none"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.title}</span>
                      {item.enterprise && (
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px] h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200"
                        >
                          Enterprise
                        </Badge>
                      )}
                      {item.comingSoon && (
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px] h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200"
                        >
                          Soon
                        </Badge>
                      )}
                      {locked && (
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px] h-5 px-1.5 bg-muted text-muted-foreground border-border"
                        >
                          Add-on
                        </Badge>
                      )}
                      {badgeCounts[item.href] && (
                        <Badge
                          variant="secondary"
                          className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px] tabular-nums bg-sidebar-accent text-sidebar-accent-foreground"
                          aria-label={`${badgeCounts[item.href]} ${badgeHint[item.href] ?? ""}`}
                        >
                          {badgeCounts[item.href]}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                    {item.children && (
                      <SidebarMenuSub>
                        {item.children.map((child: any) => {
                          return (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                render={<Link href={child.href} />}
                                className="gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                              >
                                <child.icon className="size-3.5 shrink-0" />
                                <span>{child.title}</span>
                                {badgeCounts[child.href] && (
                                  <Badge
                                    variant="secondary"
                                    className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px] tabular-nums bg-sidebar-accent text-sidebar-accent-foreground"
                                    aria-label={`${badgeCounts[child.href]} ${badgeHint[child.href] ?? ""}`}
                                  >
                                    {badgeCounts[child.href]}
                                  </Badge>
                                )}
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-widest text-[10px]">
            More
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings" />}
                  className="text-sidebar-foreground/80 hover:text-sidebar-foreground gap-3"
                >
                  <Settings className="size-4 shrink-0" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors" />
            }
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start leading-tight min-w-0">
              <span className="font-medium truncate text-sidebar-foreground">
                {org.businessName || "Business"}
              </span>
              <span className="text-xs text-sidebar-foreground/60 truncate">
                {userEmail}
              </span>
            </div>
            <ChevronDown className="ml-auto size-3 shrink-0 text-sidebar-foreground/50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuItem render={<Link href="/profile" />}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/billing" />}>
              Billing
            </DropdownMenuItem>
            <SignOutMenuItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

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
  BarChart3,
  Receipt,
  Mail,
  Building,
  Truck,
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
    badge: "6",
  },
  {
    title: "Estimates",
    href: "/estimates",
    icon: FileText,
    badge: "3",
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
    badge: "4",
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
  },
  {
    title: "Fleet Management",
    href: "/vehicles",
    icon: Truck,
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
  },
];

export async function AppSidebar() {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      className="gap-3 text-sidebar-foreground/80 hover:text-sidebar-foreground"
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
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-[10px] h-5 px-1.5 bg-sidebar-accent text-sidebar-accent-foreground"
                        >
                          {item.badge}
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
            <DropdownMenuItem className="text-destructive" render={<Link href="/auth/signout" />}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

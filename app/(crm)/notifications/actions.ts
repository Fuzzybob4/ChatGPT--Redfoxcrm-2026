"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";

// Every action here works on the signed-in user's own business. The orgId
// arguments are kept for compatibility but ignored.

async function myOrgId(): Promise<string> {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not authenticated");
  return org.orgId;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getNotifications(_orgId?: string) {
  const orgId = await myOrgId().catch(() => null);
  if (!orgId) return [];
  const { data, error } = await createAdminClient()
    .from("notifications")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
  return data || [];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getUnreadNotificationCount(_orgId?: string) {
  const orgId = await myOrgId().catch(() => null);
  if (!orgId) return 0;
  const { count, error } = await createAdminClient()
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_read", false);
  if (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }
  return count || 0;
}

export async function markNotificationAsRead(notificationId: string) {
  const orgId = await myOrgId();
  const { error } = await createAdminClient()
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("org_id", orgId);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function markAllNotificationsAsRead(_orgId?: string) {
  const orgId = await myOrgId();
  const { error } = await createAdminClient()
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function deleteNotification(notificationId: string) {
  const orgId = await myOrgId();
  const { error } = await createAdminClient().from("notifications").delete().eq("id", notificationId).eq("org_id", orgId);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteAllNotifications(_orgId?: string) {
  const orgId = await myOrgId();
  const { error } = await createAdminClient().from("notifications").delete().eq("org_id", orgId);
  if (error) throw error;
}

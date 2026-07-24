"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { getNotifications, markNotificationAsRead, deleteNotification, deleteAllNotifications } from "./actions";
import { useLocation } from "@/lib/location-context";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedLocationId } = useLocation();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const notifs = await getNotifications(selectedLocationId);
      setNotifications(notifs);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      await loadNotifications();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      await loadNotifications();
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Delete all notifications?")) return;
    try {
      await deleteAllNotifications(selectedLocationId);
      await loadNotifications();
    } catch (error) {
      console.error("Failed to delete all notifications:", error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "work_order_created":
        return "New Work Order Request";
      case "ticket_created":
        return "New Support Ticket";
      case "job_completed":
        return "Job Completed";
      case "invoice_paid":
        return "Invoice Paid";
      default:
        return "Notification";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "work_order_created":
        return "🔨";
      case "ticket_created":
        return "🎫";
      case "job_completed":
        return "✓";
      case "invoice_paid":
        return "💰";
      default:
        return "📢";
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "work_order_created":
        return <Badge className="bg-blue-100 text-blue-800">Work Order</Badge>;
      case "ticket_created":
        return <Badge className="bg-amber-100 text-amber-800">Support</Badge>;
      case "job_completed":
        return <Badge className="bg-green-100 text-green-800">Job</Badge>;
      case "invoice_paid":
        return <Badge className="bg-emerald-100 text-emerald-800">Invoice</Badge>;
      default:
        return <Badge>{getTypeLabel(type)}</Badge>;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
            : "All caught up!"
        }
        actions={
          notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDeleteAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )
        }
      />

      {loading ? (
        <div className="flex items-center justify-center p-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No notifications</h3>
            <p className="text-sm text-muted-foreground">You're all caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`transition-colors ${
                notif.read ? "bg-muted/30" : "bg-primary/5 border-primary/20"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="text-2xl mt-0.5 shrink-0">{getTypeIcon(notif.type)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {getTypeBadge(notif.type)}
                        {!notif.read && (
                          <Badge variant="secondary" className="bg-primary text-white">
                            New
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-sm">{notif.title}</h4>
                      {notif.message && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!notif.read && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-xs"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Read
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(notif.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

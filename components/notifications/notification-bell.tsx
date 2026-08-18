'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, X, Wrench, LifeBuoy, CheckCircle2, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { getNotifications, getUnreadNotificationCount, markNotificationAsRead } from '@/app/(crm)/notifications/actions';

interface NotificationBellProps {
  orgId: string;
}

export function NotificationBell({ orgId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [orgId]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(orgId),
        getUnreadNotificationCount(orgId),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'work_order_created':
        return Wrench;
      case 'ticket_created':
        return LifeBuoy;
      case 'job_completed':
        return CheckCircle2;
      case 'invoice_paid':
        return Receipt;
      default:
        return Bell;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="p-2">
          <h3 className="font-semibold text-sm mb-2">Notifications</h3>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => {
                const NotifIcon = getNotificationIcon(notif.type);
                return (
                <div
                  key={notif.id}
                  className={`p-3 rounded-lg text-sm border ${
                    notif.is_read ? 'border-transparent opacity-60' : 'border-primary/20 bg-primary/5 font-medium'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                          <NotifIcon className="size-3.5 text-foreground" />
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-xs leading-tight">{notif.title}</p>
                          {notif.message && (
                            <p className="text-xs text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                              {notif.message}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(notif.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="shrink-0 hover:bg-muted rounded p-1"
                        aria-label="Mark as read"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button variant="ghost" size="sm" className="w-full text-xs" render={<Link href="/notifications" />}>
                View All Notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

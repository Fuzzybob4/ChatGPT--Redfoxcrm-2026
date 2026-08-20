'use client';

import { useState, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  CheckCircle2,
  Clock,
  Wrench,
  LifeBuoy,
  Receipt,
  Bell,
  CheckCheck,
} from 'lucide-react';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from './actions';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_META: Record<
  string,
  { label: string; icon: React.ElementType; badge: string }
> = {
  work_order_created: {
    label: 'Trouble Call',
    icon: Wrench,
    badge: 'bg-primary/15 text-primary border-primary/30',
  },
  ticket_created: {
    label: 'Support',
    icon: LifeBuoy,
    badge: 'bg-chart-4/15 text-foreground border-chart-4/40',
  },
  job_completed: {
    label: 'Job',
    icon: CheckCircle2,
    badge: 'bg-chart-2/15 text-foreground border-chart-2/40',
  },
  invoice_paid: {
    label: 'Invoice',
    icon: Receipt,
    badge: 'bg-chart-3/15 text-foreground border-chart-3/40',
  },
};

function meta(type: string) {
  return (
    TYPE_META[type] ?? {
      label: 'Notification',
      icon: Bell,
      badge: 'bg-muted text-muted-foreground border-border',
    }
  );
}

export function NotificationsClient({
  orgId,
  initialNotifications,
}: {
  orgId: string;
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [pending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handleMarkAsRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    startTransition(async () => {
      await markNotificationAsRead(id);
    });
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    startTransition(async () => {
      await markAllNotificationsAsRead(orgId);
    });
  }

  function handleDelete(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    startTransition(async () => {
      await deleteNotification(id);
    });
  }

  function handleDeleteAll() {
    setNotifications([]);
    startTransition(async () => {
      await deleteAllNotifications(orgId);
    });
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
            : 'All caught up'
        }
        actions={
          notifications.length > 0 ? (
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={pending}>
                  <CheckCheck className="mr-2 size-4" />
                  Mark all read
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDeleteAll} disabled={pending}>
                <Trash2 className="mr-2 size-4" />
                Clear all
              </Button>
            </div>
          ) : null
        }
      />

      <div className="p-4 md:p-6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
            <CheckCircle2 className="size-10 text-muted-foreground" />
            <div>
              <h3 className="text-base font-semibold">No notifications</h3>
              <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {notifications.map((notif) => {
              const m = meta(notif.type);
              const Icon = m.icon;
              return (
                <Card
                  key={notif.id}
                  className={`transition-colors ${
                    notif.is_read ? 'bg-card' : 'border-primary/30 bg-primary/5'
                  }`}
                >
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-4 text-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${m.badge}`}>
                            {m.label}
                          </Badge>
                          {!notif.is_read && (
                            <Badge className="h-5 px-1.5 text-[10px]">New</Badge>
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-pretty">{notif.title}</h4>
                        {notif.message && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {notif.message}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {new Date(notif.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!notif.is_read && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-xs"
                        >
                          <CheckCircle2 className="mr-1 size-3" />
                          Read
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(notif.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete notification"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

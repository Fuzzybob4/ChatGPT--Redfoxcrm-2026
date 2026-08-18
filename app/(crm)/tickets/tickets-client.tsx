'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  LifeBuoy,
  Wrench,
  Clock,
  User,
  CalendarPlus,
  CheckCircle2,
  AlertTriangle,
  Inbox,
} from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type TroubleCall,
  type SupportTicket,
  updateTroubleCallStatus,
  updateSupportTicketStatus,
  convertTroubleCallToJob,
} from './actions';

const URGENCY_STYLES: Record<string, string> = {
  low: 'bg-muted text-muted-foreground border-border',
  normal: 'bg-secondary text-secondary-foreground border-border',
  high: 'bg-chart-4/15 text-foreground border-chart-4/40',
  emergency: 'bg-destructive/15 text-destructive border-destructive/40',
};

const REQUEST_STATUS: Record<string, string> = {
  new: 'bg-primary/15 text-primary border-primary/30',
  scheduled: 'bg-chart-2/15 text-foreground border-chart-2/40',
  converted: 'bg-chart-3/15 text-foreground border-chart-3/40',
  closed: 'bg-muted text-muted-foreground border-border',
};

const TICKET_STATUS: Record<string, string> = {
  open: 'bg-primary/15 text-primary border-primary/30',
  in_progress: 'bg-chart-4/15 text-foreground border-chart-4/40',
  resolved: 'bg-chart-2/15 text-foreground border-chart-2/40',
  closed: 'bg-muted text-muted-foreground border-border',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ConvertDialog({
  request,
  open,
  onOpenChange,
  onConverted,
}: {
  request: TroubleCall | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: () => void;
}) {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('12:00');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleConvert() {
    if (!request || !date) {
      setError('Choose a date to schedule this job.');
      return;
    }
    setError('');
    startTransition(async () => {
      try {
        await convertTroubleCallToJob({
          requestId: request.id,
          scheduledDate: date,
          startTime: start,
          endTime: end,
        });
        onOpenChange(false);
        onConverted();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to convert to job.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle>Schedule as Job</DialogTitle>
          <DialogDescription>
            Convert &ldquo;{request?.title}&rdquo; into a scheduled job for {request?.customerName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date</label>
            <Input type="date" className="h-11" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start</label>
              <Input type="time" className="h-11" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End</label>
              <Input type="time" className="h-11" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="size-3.5" />
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="h-11" onClick={handleConvert} disabled={!date || pending}>
              {pending ? 'Scheduling...' : 'Schedule Job'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TicketsClient({
  troubleCalls,
  supportTickets,
}: {
  troubleCalls: TroubleCall[];
  supportTickets: SupportTicket[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [convertTarget, setConvertTarget] = useState<TroubleCall | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);

  const openTroubleCalls = useMemo(
    () => troubleCalls.filter((t) => t.status === 'new' || t.status === 'scheduled').length,
    [troubleCalls],
  );
  const openTickets = useMemo(
    () => supportTickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
    [supportTickets],
  );

  function refresh() {
    router.refresh();
  }

  function setTroubleStatus(id: string, status: string) {
    startTransition(async () => {
      await updateTroubleCallStatus(id, status);
      refresh();
    });
  }

  function setTicketStatus(id: string, status: string) {
    startTransition(async () => {
      await updateSupportTicketStatus(id, status);
      refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="Trouble Calls & Tickets"
        description="Service requests and support messages submitted by your customers"
      />

      <div className="p-4 md:p-6">
        <Tabs defaultValue="trouble-calls" className="w-full">
          <TabsList>
            <TabsTrigger value="trouble-calls">
              <Wrench className="size-4" />
              Trouble Calls
              {openTroubleCalls > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {openTroubleCalls}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <LifeBuoy className="size-4" />
              Support Tickets
              {openTickets > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {openTickets}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Trouble calls */}
          <TabsContent value="trouble-calls" className="mt-4">
            {troubleCalls.length === 0 ? (
              <EmptyState icon={Inbox} label="No trouble calls submitted yet." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {troubleCalls.map((call) => (
                  <Card key={call.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-tight text-pretty">{call.title}</p>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] capitalize ${REQUEST_STATUS[call.status] ?? ''}`}
                        >
                          {call.status}
                        </Badge>
                      </div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${URGENCY_STYLES[call.urgency] ?? ''}`}
                        >
                          {call.urgency}
                        </Badge>
                        {call.createdFromPortal && (
                          <Badge variant="outline" className="text-[10px]">
                            Portal
                          </Badge>
                        )}
                      </div>
                      {call.description && (
                        <p className="mb-3 text-xs text-muted-foreground line-clamp-3">
                          {call.description}
                        </p>
                      )}
                      <div className="mb-4 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3 shrink-0" />
                          <span className="truncate">{call.customerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3 shrink-0" />
                          <span>{formatDate(call.createdAt)}</span>
                        </div>
                      </div>

                      {call.status === 'converted' ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-chart-2">
                          <CheckCircle2 className="size-3.5" />
                          Scheduled as job
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setConvertTarget(call);
                              setConvertOpen(true);
                            }}
                            disabled={pending}
                          >
                            <CalendarPlus className="mr-1.5 size-3.5" />
                            Schedule Job
                          </Button>
                          <Select
                            value={call.status}
                            onValueChange={(v) => v && setTroubleStatus(call.id, v)}
                          >
                            <SelectTrigger className="h-9 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Support tickets */}
          <TabsContent value="tickets" className="mt-4">
            {supportTickets.length === 0 ? (
              <EmptyState icon={Inbox} label="No support tickets submitted yet." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {supportTickets.map((ticket) => (
                  <Card key={ticket.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-tight text-pretty">
                          {ticket.subject}
                        </p>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] capitalize ${TICKET_STATUS[ticket.status] ?? ''}`}
                        >
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {ticket.priority} priority
                        </Badge>
                        {ticket.createdFromPortal && (
                          <Badge variant="outline" className="text-[10px]">
                            Portal
                          </Badge>
                        )}
                      </div>
                      {ticket.description && (
                        <p className="mb-3 text-xs text-muted-foreground line-clamp-3">
                          {ticket.description}
                        </p>
                      )}
                      <div className="mb-4 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3 shrink-0" />
                          <span className="truncate">{ticket.customerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3 shrink-0" />
                          <span>{formatDate(ticket.createdAt)}</span>
                        </div>
                      </div>
                      <Select
                        value={ticket.status}
                        onValueChange={(v) => v && setTicketStatus(ticket.id, v)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ConvertDialog
        request={convertTarget}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={refresh}
      />
    </>
  );
}

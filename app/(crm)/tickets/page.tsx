import { getTroubleCalls, getSupportTickets } from './actions';
import { TicketsClient } from './tickets-client';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const [troubleCalls, supportTickets] = await Promise.all([
    getTroubleCalls(),
    getSupportTickets(),
  ]);

  return <TicketsClient troubleCalls={troubleCalls} supportTickets={supportTickets} />;
}

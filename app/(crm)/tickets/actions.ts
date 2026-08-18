'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

export interface TroubleCall {
  id: string;
  customerId: string | null;
  customerName: string;
  title: string;
  description: string | null;
  urgency: string;
  status: string;
  preferredDate: string | null;
  createdScheduledJobId: string | null;
  createdFromPortal: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  customerId: string | null;
  customerName: string;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  createdFromPortal: boolean;
  createdAt: string;
}

function customerName(c: { first_name?: string | null; last_name?: string | null } | null): string {
  if (!c) return 'Unknown customer';
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown customer';
}

/**
 * Fetch all customer-submitted trouble calls (work order requests) for the org.
 */
export async function getTroubleCalls(): Promise<TroubleCall[]> {
  const org = await getCurrentOrg();
  if (!org) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('work_order_requests')
    .select(
      'id, customer_id, title, description, urgency, status, preferred_date, created_scheduled_job_id, created_from_portal, created_at, customers(first_name, last_name)',
    )
    .eq('org_id', org.orgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching trouble calls:', error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: customerName(row.customers),
    title: row.title,
    description: row.description,
    urgency: row.urgency,
    status: row.status,
    preferredDate: row.preferred_date,
    createdScheduledJobId: row.created_scheduled_job_id,
    createdFromPortal: row.created_from_portal,
    createdAt: row.created_at,
  }));
}

/**
 * Fetch all customer-submitted support tickets for the org.
 */
export async function getSupportTickets(): Promise<SupportTicket[]> {
  const org = await getCurrentOrg();
  if (!org) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('support_tickets')
    .select(
      'id, customer_id, subject, description, priority, status, created_from_portal, created_at, customers(first_name, last_name)',
    )
    .eq('org_id', org.orgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching support tickets:', error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: customerName(row.customers),
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    status: row.status,
    createdFromPortal: row.created_from_portal,
    createdAt: row.created_at,
  }));
}

export async function updateTroubleCallStatus(id: string, status: string) {
  const org = await getCurrentOrg();
  if (!org) throw new Error('Not authenticated');
  const supabase = await createClient();

  const { error } = await supabase
    .from('work_order_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', org.orgId);

  if (error) throw new Error(error.message);
  revalidatePath('/tickets');
}

export async function updateSupportTicketStatus(id: string, status: string) {
  const org = await getCurrentOrg();
  if (!org) throw new Error('Not authenticated');
  const supabase = await createClient();

  const { error } = await supabase
    .from('support_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', org.orgId);

  if (error) throw new Error(error.message);
  revalidatePath('/tickets');
}

/**
 * Convert a trouble call into a scheduled job, linking the two records.
 */
export async function convertTroubleCallToJob(input: {
  requestId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
}): Promise<string> {
  const org = await getCurrentOrg();
  if (!org) throw new Error('Not authenticated');
  const supabase = await createClient();

  // Load the request (scoped to org via RLS)
  const { data: request, error: reqErr } = await supabase
    .from('work_order_requests')
    .select('id, customer_id, property_id, title, description, status, created_scheduled_job_id')
    .eq('id', input.requestId)
    .eq('org_id', org.orgId)
    .single();

  if (reqErr || !request) throw new Error(reqErr?.message ?? 'Trouble call not found');
  if (request.created_scheduled_job_id) {
    throw new Error('This trouble call has already been converted to a job.');
  }

  // Pull the customer's service address so the job has a location
  let address: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let zip: string | null = null;
  if (request.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('address, city, state, zip_code')
      .eq('id', request.customer_id)
      .maybeSingle();
    address = customer?.address ?? null;
    city = customer?.city ?? null;
    state = customer?.state ?? null;
    zip = customer?.zip_code ?? null;
  }

  const { data: job, error: jobErr } = await supabase
    .from('scheduled_jobs')
    .insert({
      org_id: org.orgId,
      customer_id: request.customer_id,
      property_id: request.property_id ?? null,
      title: request.title,
      description: request.description,
      job_type: 'service',
      scheduled_date: input.scheduledDate,
      start_time: input.startTime,
      end_time: input.endTime,
      address,
      city,
      state,
      zip_code: zip,
      status: 'scheduled',
      status_key: 'scheduled',
      priority: 'normal',
      season_year: new Date().getFullYear(),
      notes: 'Created from customer trouble call',
    })
    .select('id')
    .single();

  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Failed to create job');

  // Link back and mark the request converted
  const { error: linkErr } = await supabase
    .from('work_order_requests')
    .update({
      status: 'converted',
      created_scheduled_job_id: job.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id)
    .eq('org_id', org.orgId);

  if (linkErr) throw new Error(linkErr.message);

  revalidatePath('/tickets');
  revalidatePath('/jobs');
  return job.id;
}

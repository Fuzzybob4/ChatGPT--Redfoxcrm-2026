'use server';

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type TaxSettings = Database['public']['Tables']['tax_settings']['Row'];
type PaymentTerms = Database['public']['Tables']['payment_terms']['Row'];
type EmailReminder = Database['public']['Tables']['invoice_email_reminders']['Row'];

// Tax Settings Actions
export async function getTaxSettings(orgId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('tax_settings')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('is_default', { ascending: false });

  if (error) throw new Error(`Failed to fetch tax settings: ${error.message}`);
  return data;
}

export async function createTaxSetting(
  orgId: string,
  taxName: string,
  taxRate: number,
  description?: string,
  isDefault: boolean = false
) {
  const supabase = createClient();
  
  // If setting as default, unset other defaults
  if (isDefault) {
    await supabase
      .from('tax_settings')
      .update({ is_default: false })
      .eq('org_id', orgId);
  }

  const { data, error } = await supabase
    .from('tax_settings')
    .insert({
      org_id: orgId,
      tax_name: taxName,
      tax_rate: taxRate,
      description,
      is_default: isDefault,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create tax setting: ${error.message}`);
  return data;
}

export async function updateTaxSetting(
  taxSettingId: string,
  updates: Partial<Omit<TaxSettings, 'id' | 'created_at'>>
) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('tax_settings')
    .update(updates)
    .eq('id', taxSettingId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update tax setting: ${error.message}`);
  return data;
}

export async function deleteTaxSetting(taxSettingId: string) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('tax_settings')
    .update({ is_active: false })
    .eq('id', taxSettingId);

  if (error) throw new Error(`Failed to delete tax setting: ${error.message}`);
}

// Payment Terms Actions
export async function setInvoicePaymentTerms(
  invoiceId: string,
  orgId: string,
  paymentType: 'full' | 'deposit',
  fullPaymentAmount: number,
  fullPaymentDueDate: string,
  depositPercentage?: number,
  depositDueDate?: string
) {
  const supabase = createClient();
  
  const depositAmount = depositPercentage 
    ? (fullPaymentAmount * depositPercentage) / 100 
    : 0;

  const { data, error } = await supabase
    .from('payment_terms')
    .upsert(
      {
        invoice_id: invoiceId,
        org_id: orgId,
        payment_type: paymentType,
        deposit_percentage: depositPercentage || null,
        deposit_amount: depositAmount || null,
        full_payment_amount: fullPaymentAmount,
        deposit_due_date: depositDueDate || null,
        full_payment_due_date: fullPaymentDueDate,
      },
      { onConflict: 'invoice_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to set payment terms: ${error.message}`);
  return data;
}

export async function getInvoicePaymentTerms(invoiceId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('payment_terms')
    .select('*')
    .eq('invoice_id', invoiceId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch payment terms: ${error.message}`);
  }
  return data || null;
}

// Email Reminder Settings Actions
export async function getEmailReminderSettings(orgId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('email_reminder_settings')
    .select('*')
    .eq('org_id', orgId);

  if (error) throw new Error(`Failed to fetch email reminder settings: ${error.message}`);
  return data;
}

export async function updateEmailReminderSettings(
  orgId: string,
  reminderType: 'invoice_due' | 'payment_received' | 'overdue',
  enabled: boolean,
  reminderIntervals: number[] // [2, 7, 14]
) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('email_reminder_settings')
    .upsert(
      {
        org_id: orgId,
        reminder_type: reminderType,
        enabled,
        reminder_intervals: JSON.stringify(reminderIntervals),
      },
      { onConflict: 'org_id,reminder_type' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to update email reminder settings: ${error.message}`);
  return data;
}

// Schedule Email Reminders for new invoice
export async function scheduleInvoiceEmailReminders(
  invoiceId: string,
  customerId: string,
  orgId: string,
  customerEmail: string,
  invoiceCreatedDate: Date
) {
  const supabase = createClient();

  // Get email reminder settings
  const settings = await getEmailReminderSettings(orgId);
  const invoiceDueSettings = settings.find((s) => s.reminder_type === 'invoice_due');

  if (!invoiceDueSettings?.enabled) return;

  const reminderIntervals = JSON.parse(invoiceDueSettings.reminder_intervals) as number[];
  const reminders: Partial<EmailReminder>[] = [];

  // Initial invoice sent reminder
  reminders.push({
    org_id: orgId,
    invoice_id: invoiceId,
    customer_id: customerId,
    reminder_type: 'invoice_sent',
    reminder_day_offset: 0,
    scheduled_for: invoiceCreatedDate,
    email_address: customerEmail,
  });

  // Payment reminders at configured intervals
  reminderIntervals.forEach((days) => {
    const scheduledDate = new Date(invoiceCreatedDate);
    scheduledDate.setDate(scheduledDate.getDate() + days);

    reminders.push({
      org_id: orgId,
      invoice_id: invoiceId,
      customer_id: customerId,
      reminder_type: 'payment_reminder',
      reminder_day_offset: days,
      scheduled_for: scheduledDate,
      email_address: customerEmail,
    });
  });

  const { error } = await supabase
    .from('invoice_email_reminders')
    .insert(reminders as any[]);

  if (error) throw new Error(`Failed to schedule email reminders: ${error.message}`);
}

// Get pending email reminders to send
export async function getPendingEmailReminders() {
  const supabase = createClient();
  
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('invoice_email_reminders')
    .select(
      `
      *,
      invoices:invoice_id(invoice_number, total_amount, due_date, customer_id),
      customers:customer_id(name, email),
      organizations:org_id(name, email)
    `
    )
    .lte('scheduled_for', now)
    .is('sent_at', null)
    .is('failed_at', null)
    .order('scheduled_for', { ascending: true });

  if (error) throw new Error(`Failed to fetch pending reminders: ${error.message}`);
  return data;
}

// Mark reminder as sent
export async function markReminderAsSent(reminderId: string) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('invoice_email_reminders')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', reminderId);

  if (error) throw new Error(`Failed to mark reminder as sent: ${error.message}`);
}

// Mark reminder as failed
export async function markReminderAsFailed(reminderId: string, reason: string) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('invoice_email_reminders')
    .update({ 
      failed_at: new Date().toISOString(),
      failure_reason: reason,
    })
    .eq('id', reminderId);

  if (error) throw new Error(`Failed to mark reminder as failed: ${error.message}`);
}

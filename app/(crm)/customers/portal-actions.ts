'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Generate a unique portal access token for a customer
 */
function generatePortalToken(): string {
  // Generate a 32-character alphanumeric token
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Generate or retrieve portal access token for a customer
 */
export async function getOrCreatePortalToken(customerId: string): Promise<string> {
  const admin = createAdminClient();

  // Check if customer already has a token
  const { data: customer, error: fetchError } = await admin
    .from('customers')
    .select('portal_access_token')
    .eq('id', customerId)
    .single();

  if (fetchError || !customer) {
    throw new Error('Customer not found');
  }

  // If token exists, return it
  if (customer.portal_access_token) {
    return customer.portal_access_token;
  }

  // Generate new token
  const newToken = generatePortalToken();

  const { error: updateError } = await admin
    .from('customers')
    .update({
      portal_access_token: newToken,
      portal_token_created_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (updateError) {
    throw new Error('Failed to generate portal token');
  }

  return newToken;
}

/**
 * Verify a portal access token and return the customer
 */
export async function verifyPortalToken(token: string): Promise<any> {
  const admin = createAdminClient();

  const { data: customer, error } = await admin
    .from('customers')
    .select('id, first_name, last_name, email, org_id')
    .eq('portal_access_token', token)
    .single();

  if (error || !customer) {
    return null;
  }

  return customer;
}

/**
 * Regenerate portal token (invalidate old one)
 */
export async function regeneratePortalToken(customerId: string): Promise<string> {
  const admin = createAdminClient();

  const newToken = generatePortalToken();

  const { error } = await admin
    .from('customers')
    .update({
      portal_access_token: newToken,
      portal_token_created_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (error) {
    throw new Error('Failed to regenerate portal token');
  }

  return newToken;
}

'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentOrg } from '@/lib/org';
import { randomBytes } from 'node:crypto';

export interface PortalCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  org_id: string;
}

/**
 * Generate a unique portal access token for a customer
 */
function generatePortalToken(): string {
  return randomBytes(32).toString('base64url');
}

export type PortalTokenResult = { ok: true; token: string } | { ok: false; error: string };

function logPortalError(scope: string, error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null) {
  console.error(`[${scope}] failed`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

function portalColumnMessage(error: { code?: string; message?: string } | null) {
  const text = error?.message ?? "";
  const missing =
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    /portal_access_token|schema cache|does not exist/i.test(text);
  if (missing) {
    return "Portal links need customers.portal_access_token. That column is not in the database yet (see migrations/add_customer_portal_token.sql).";
  }
  return text || "Could not load the portal link.";
}

/**
 * Generate or retrieve portal access token for a customer.
 * Returns a result instead of throwing so a missing column does not 500 the
 * customer page. The page calls this as soon as it opens.
 */
export async function getOrCreatePortalToken(customerId: string): Promise<PortalTokenResult> {
  try {
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Not authenticated" };
    const admin = createAdminClient();

    const { data: customer, error: fetchError } = await admin
      .from('customers')
      .select('portal_access_token')
      .eq('id', customerId)
      .eq('org_id', org.orgId)
      .maybeSingle();

    if (fetchError) {
      logPortalError("getOrCreatePortalToken", fetchError);
      return { ok: false, error: portalColumnMessage(fetchError) };
    }
    if (!customer) return { ok: false, error: "Customer not found" };

    if (customer.portal_access_token) {
      return { ok: true, token: customer.portal_access_token };
    }

    const newToken = generatePortalToken();
    const { error: updateError } = await admin
      .from('customers')
      .update({
        portal_access_token: newToken,
        portal_token_created_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('org_id', org.orgId);

    if (updateError) {
      logPortalError("getOrCreatePortalToken update", updateError);
      return { ok: false, error: portalColumnMessage(updateError) };
    }

    return { ok: true, token: newToken };
  } catch (e) {
    console.error("[getOrCreatePortalToken] unexpected error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Could not create a portal link" };
  }
}

/**
 * Verify a portal access token and return the customer
 */
export async function verifyPortalToken(token: string): Promise<PortalCustomer | null> {
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
export async function regeneratePortalToken(customerId: string): Promise<PortalTokenResult> {
  try {
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "Not authenticated" };
    const admin = createAdminClient();

    const newToken = generatePortalToken();
    const { error } = await admin
      .from('customers')
      .update({
        portal_access_token: newToken,
        portal_token_created_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('org_id', org.orgId);

    if (error) {
      logPortalError("regeneratePortalToken", error);
      return { ok: false, error: portalColumnMessage(error) };
    }
    return { ok: true, token: newToken };
  } catch (e) {
    console.error("[regeneratePortalToken] unexpected error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Could not regenerate the portal link" };
  }
}

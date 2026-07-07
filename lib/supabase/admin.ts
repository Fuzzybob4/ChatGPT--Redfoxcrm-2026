import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key.
 * Used while the app's auth migration to Supabase Auth is in progress —
 * queries run on the server and results are scoped in application code.
 * NEVER import this in client components.
 */
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

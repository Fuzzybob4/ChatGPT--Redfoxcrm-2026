import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = '__v0_verify_owner@example.com'
const PASSWORD = 'V0VerifyTest!2026'

// 1. Create a confirmed auth user via the Admin API (GoTrue-valid password hash)
const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: 'Verify Owner', plan: 'starter' },
})

if (createErr && !String(createErr.message).includes('already been registered')) {
  console.error('[v0] createUser error:', createErr.message)
  process.exit(1)
}

// Resolve the user id (whether just created or pre-existing)
let userId = created?.user?.id
if (!userId) {
  const { data: list } = await supabase.auth.admin.listUsers()
  userId = list.users.find((u) => u.email === EMAIL)?.id
}
console.log('[v0] user id:', userId)

// 2. Create an organization (simulating completed onboarding)
const { data: org, error: orgErr } = await supabase
  .from('organizations')
  .insert({
    name: '__v0_verify_org',
    vertical: 'holiday_lighting',
    plan: 'starter',
    subscription_status: 'trialing',
    trial_ends_at: new Date(Date.now() + 30 * 864e5).toISOString(),
  })
  .select('id')
  .single()

if (orgErr) {
  console.error('[v0] org insert error:', orgErr.message)
  process.exit(1)
}
console.log('[v0] org id:', org.id)

// 3. Location, membership, business profile
const { data: loc } = await supabase
  .from('locations')
  .insert({ org_id: org.id, name: 'Main Location', city: 'Austin', state: 'TX' })
  .select('id')
  .single()

await supabase.from('user_memberships').insert({ user_id: userId, org_id: org.id, role: 'admin' })
await supabase.from('business_profiles').insert({ org_id: org.id, business_name: '__v0_verify_org' })

// 4. A customer + a portal-submitted trouble call and support ticket to verify the inbox
const { data: cust } = await supabase
  .from('customers')
  .insert({
    org_id: org.id,
    location_id: loc.id,
    first_name: 'Jamie',
    last_name: 'Rivera',
    email: 'jamie.rivera@example.com',
    phone: '555-222-3344',
    address: '88 Maple Court',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
  })
  .select('id')
  .single()

await supabase.from('work_order_requests').insert({
  org_id: org.id,
  customer_id: cust.id,
  title: 'Half my roofline went dark',
  description: 'The lights on the front-left section stopped working after the storm last night.',
  urgency: 'high',
  status: 'new',
  created_from_portal: true,
})

await supabase.from('support_tickets').insert({
  org_id: org.id,
  customer_id: cust.id,
  subject: 'Question about my December invoice',
  description: 'I was charged a deposit but want to confirm the balance and payment date.',
  priority: 'medium',
  status: 'open',
  created_from_portal: true,
})

console.log('[v0] seed complete for', EMAIL)

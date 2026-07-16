import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { email, firstName, lastName } = await req.json();

    if (!email || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAdminClient();

    // Insert into newsletter subscribers table
    const { error } = await supabase.from('newsletter_subscribers').insert({
      email,
      first_name: firstName,
      last_name: lastName,
      subscribed_at: new Date().toISOString(),
    });

    if (error) {
      // If record already exists, just return success (idempotent)
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ success: true, message: 'Already subscribed' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Subscribed successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    return new Response(
      JSON.stringify({ error: 'Subscription failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

import { put } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadErrorResponse } from '@/lib/upload-error';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const customerId = formData.get('customerId') as string;
    const photoType = formData.get('photoType') as string || 'Other';
    const description = formData.get('description') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!customerId) {
      return NextResponse.json({ error: 'No customer ID provided' }, { status: 400 });
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only images can be uploaded' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photos must be under 10MB' }, { status: 400 });
    }

    // customer_photos.org_id is required. Reading the customer through the
    // user's session also confirms (via RLS) they can access this customer.
    const { data: customer } = await supabase
      .from('customers')
      .select('id, org_id')
      .eq('id', customerId)
      .maybeSingle();
    if (!customer?.org_id) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'photo.jpg';
    const filename = `customers/${customerId}/photos/${timestamp}-${safeName}`;

    // Upload to Blob with private access
    const blob = await put(filename, file, {
      access: 'private',
    });

    // Save photo metadata to database
    const { data: photoData, error: insertError } = await supabase
      .from('customer_photos')
      .insert({
        customer_id: customerId,
        org_id: customer.org_id,
        photo_url: blob.pathname,
        file_size: file.size,
        photo_type: photoType,
        description: description,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save photo metadata:', insertError);
      return NextResponse.json(
        { error: 'Failed to save photo metadata' },
        { status: 500 }
      );
    }

    // Return the pathname (not the URL since it's private)
    return NextResponse.json({
      pathname: blob.pathname,
      filename: file.name,
      photoId: photoData.id,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return uploadErrorResponse(error);
  }
}

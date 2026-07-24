import { put } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a unique filename with customer ID and timestamp
    const timestamp = Date.now();
    const filename = `customers/${customerId}/photos/${timestamp}-${file.name}`;

    // Upload to Blob with private access
    const blob = await put(filename, file, {
      access: 'private',
    });

    // Save photo metadata to database
    const { data: photoData, error: insertError } = await supabase
      .from('customer_photos')
      .insert({
        customer_id: customerId,
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
    return NextResponse.json(
      { error: 'Photo upload failed' },
      { status: 500 }
    );
  }
}

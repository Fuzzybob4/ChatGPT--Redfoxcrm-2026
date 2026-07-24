import { put } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const propertyId = formData.get('propertyId') as string;
    const customerId = formData.get('customerId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!propertyId || !customerId) {
      return NextResponse.json({ error: 'Missing property or customer ID' }, { status: 400 });
    }

    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a unique filename with property ID and timestamp
    const timestamp = Date.now();
    const filename = `properties/${propertyId}/photos/${timestamp}-${file.name}`;

    // Upload to Blob with private access
    const blob = await put(filename, file, {
      access: 'private',
    });

    // Save photo metadata to database
    const { data: photoData, error: insertError } = await supabase
      .from('property_photos')
      .insert({
        property_id: propertyId,
        customer_id: customerId,
        photo_url: blob.pathname,
        file_size: file.size,
        photo_type: file.type,
        description: '',
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

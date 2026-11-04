import { safeFileName, uploadPhoto } from '@/lib/photo-storage';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadErrorResponse } from '@/lib/upload-error';

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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the property's org/location and confirm it belongs to the given customer.
    // RLS still enforces org membership, but this gives us the org_id/location_id to
    // stamp on the new row (org_id is required and not derivable from the client input).
    const { data: property, error: propertyError } = await supabase
      .from('customer_properties')
      .select('id, customer_id, location_id, customers!inner(id, org_id)')
      .eq('id', propertyId)
      .eq('customer_id', customerId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const customerRel = property.customers as unknown as { id: string; org_id: string } | { id: string; org_id: string }[];
    const orgId = Array.isArray(customerRel) ? customerRel[0]?.org_id : customerRel?.org_id;

    if (!orgId) {
      return NextResponse.json({ error: 'Unable to resolve organization for property' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only images can be uploaded' }, { status: 400 });
    }

    const photoUrl = await uploadPhoto(
      `properties/${propertyId}/${Date.now()}-${safeFileName(file.name)}`,
      file,
    );

    // Save photo metadata to database
    const { data: photoData, error: insertError } = await supabase
      .from('property_photos')
      .insert({
        property_id: propertyId,
        customer_id: customerId,
        org_id: orgId,
        location_id: property.location_id,
        photo_url: photoUrl,
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
      pathname: photoUrl,
      filename: file.name,
      photoId: photoData.id,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return uploadErrorResponse(error);
  }
}

import { del } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    const { photoId, pathname } = await request.json();

    if (!photoId || !pathname) {
      return NextResponse.json({ error: 'Missing photoId or pathname' }, { status: 400 });
    }

    // Verify authentication
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete from database first
    const { error: dbError } = await supabase
      .from('property_photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      console.error('Failed to delete photo from database:', dbError);
      return NextResponse.json(
        { error: 'Failed to delete photo' },
        { status: 500 }
      );
    }

    // Delete from Blob using the pathname
    await del(pathname);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Photo delete error:', error);
    return NextResponse.json(
      { error: 'Photo deletion failed' },
      { status: 500 }
    );
  }
}

import { deletePhoto } from '@/lib/photo-storage';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    const { pathname } = await request.json();

    if (!pathname) {
      return NextResponse.json({ error: 'No pathname provided' }, { status: 400 });
    }

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete from database first
    // Row level security limits this to the user's own business. Only remove
    // the stored file if one of their rows actually pointed at it.
    const { data: deleted, error: dbError } = await supabase
      .from('customer_photos')
      .delete()
      .eq('photo_url', pathname)
      .select('id');

    if (dbError) {
      console.error('Failed to delete photo from database:', dbError);
      return NextResponse.json(
        { error: 'Failed to delete photo' },
        { status: 500 }
      );
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    await deletePhoto(pathname);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Photo delete error:', error);
    return NextResponse.json(
      { error: 'Photo deletion failed' },
      { status: 500 }
    );
  }
}

import { del } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
  try {
    const { pathname } = await request.json();

    if (!pathname) {
      return NextResponse.json({ error: 'No pathname provided' }, { status: 400 });
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

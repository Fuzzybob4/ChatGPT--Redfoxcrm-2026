import { put } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const customerId = formData.get('customerId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!customerId) {
      return NextResponse.json({ error: 'No customer ID provided' }, { status: 400 });
    }

    // Generate a unique filename with customer ID and timestamp
    const timestamp = Date.now();
    const filename = `customers/${customerId}/photos/${timestamp}-${file.name}`;

    // Upload to Blob with private access
    const blob = await put(filename, file, {
      access: 'private',
    });

    // Return the pathname (not the URL since it's private)
    return NextResponse.json({
      pathname: blob.pathname,
      filename: file.name,
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

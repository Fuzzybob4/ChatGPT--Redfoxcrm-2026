import { type NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export async function GET(request: NextRequest) {
  try {
    const rawPath = request.nextUrl.searchParams.get('pathname');

    if (!rawPath) {
      return NextResponse.json({ error: 'Missing pathname' }, { status: 400 });
    }

    // Older rows may contain the full Blob URL while newer rows contain only
    // blob.pathname. Normalize both formats before reading the private blob.
    let pathname = rawPath;
    try {
      if (/^https?:\/\//i.test(rawPath)) {
        pathname = new URL(rawPath).pathname.replace(/^\/+/, '');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid pathname' }, { status: 403 });
    }

    // Support both current and legacy upload prefixes. Existing rows use
    // customer-photos/property-photos; newer uploads use customers/properties.
    const allowedPrefix = [
      'customers/',
      'properties/',
      'customer-photos/',
      'property-photos/',
    ].some((prefix) => pathname.startsWith(prefix));
    if (!allowedPrefix) {
      return NextResponse.json({ error: 'Invalid pathname' }, { status: 403 });
    }

    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    });

    if (!result) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Blob hasn't changed — tell the browser to use its cached copy
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          'Cache-Control': 'private, no-cache',
        },
      });
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Error serving photo:', error);
    return NextResponse.json({ error: 'Failed to serve photo' }, { status: 500 });
  }
}

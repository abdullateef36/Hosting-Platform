import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  context: { params: Promise<{ siteId: string; path: string[] }> }
) {
  try {
    const { siteId, path: pathArray } = await context.params;

    if (!siteId || !pathArray || pathArray.length === 0) {
      return NextResponse.json(
        { error: 'Missing siteId or asset path' },
        { status: 400 }
      );
    }

    // Reconstruct the file path
    const requestedPath = pathArray.join('/');

    // Lazy load Firebase
    const { db } = await import('@/lib/firebase');
    const { collection, query, where, getDocs } = await import('firebase/firestore');

    const q = query(collection(db!, 'sites'), where('siteId', '==', siteId));
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json(
        { error: 'Site not found', siteId },
        { status: 404 }
      );
    }

    const doc = snap.docs[0];
    const data = doc.data() as Record<string, unknown>;
    const files = (data.files as Array<Record<string, unknown>>) || [];

    // Find the file by matching the requested path with stored paths
    const file = files.find((f) => {
      const storedPath = String((f.path || f.name || '')).replace(/^\//, '');
      const normalized = requestedPath.replace(/^\.\//, '').replace(/^\//, '');
      return storedPath === normalized || storedPath.endsWith('/' + normalized);
    });

    if (!file) {
      console.warn('Asset not found', { siteId, requestedPath, availablePaths: files.map(f => f.path) });
      return NextResponse.json(
        { error: 'Asset not found', requestedPath },
        { status: 404 }
      );
    }

    const assetUrl = String((file.url || file.secure_url || ''));
    if (!assetUrl) {
      return NextResponse.json(
        { error: 'Asset has no URL' },
        { status: 404 }
      );
    }

    // Fetch from Cloudinary
    const res = await fetch(assetUrl);

    if (!res.ok) {
      const upstreamText = await res.text().catch(() => '');
      console.error('proxy asset fetch failed', { siteId, requestedPath, assetUrl, status: res.status, body: upstreamText });
      return NextResponse.json(
        { error: 'Failed to fetch asset', requestedPath, upstreamStatus: res.status },
        { status: res.status || 502 }
      );
    }

    // Get content type from Cloudinary response or infer from file extension
    let contentType = res.headers.get('content-type') || 'application/octet-stream';

    // If content-type is too generic (like application/octet-stream), try to infer from file extension
    if (contentType === 'application/octet-stream' || contentType === 'application/x-octet-stream') {
      const ext = requestedPath.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        'html': 'text/html; charset=utf-8',
        'css': 'text/css; charset=utf-8',
        'js': 'application/javascript; charset=utf-8',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'webp': 'image/webp',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
      };
      if (ext && mimeTypes[ext]) {
        contentType = mimeTypes[ext];
      }
    }

    // Forward the asset with correct content-type
    const body = await res.arrayBuffer();
    return new Response(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': body.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year (assets are immutable)
      },
    });
  } catch (err) {
    console.error('proxy asset error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

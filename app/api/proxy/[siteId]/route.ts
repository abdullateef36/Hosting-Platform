import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await context.params;

    if (!siteId) {
      return NextResponse.json(
        { error: 'Missing siteId' },
        { status: 400 }
      );
    }

    // Lazy load Firebase only at runtime to avoid build-time initialization
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

    const indexFile = files.find((f) => {
      const path = ((f.path || f.name) || '').toString().toLowerCase();
      return (
        path.endsWith('/index.html') ||
        path === 'index.html' ||
        path.endsWith('index.html')
      );
    });

    if (!indexFile) {
      return NextResponse.json(
        { error: 'index.html not found for site', siteId },
        { status: 404 }
      );
    }

    const indexUrl = String(indexFile['url'] || '');
    if (!indexUrl) {
      return NextResponse.json(
        { error: 'index.html has no url', siteId },
        { status: 404 }
      );
    }

    // Fetch the asset from Cloudinary (or other URL)
    const res = await fetch(indexUrl);

    if (!res.ok) {
      const upstreamText = await res.text().catch(() => "");
      console.error('proxy upstream fetch failed', { siteId, indexUrl, status: res.status, body: upstreamText });
      return NextResponse.json(
        { error: 'Failed to fetch site asset', siteId, upstreamStatus: res.status },
        { status: 502 }
      );
    }

    // Fetch and rewrite index.html to point assets to the asset proxy
    const text = await res.text();
    let html = text;

    // Replace relative src/href with proxy URLs: /api/proxy/{siteId}/{path}
    const attrRegex = /(src|href)=["']([^"']+)["']/gi;

    html = html.replace(attrRegex, (match, attr, val) => {
      // If absolute URL or data/anchor, leave unchanged
      if (/^(https?:|\/\/|data:|mailto:|#)/i.test(val)) return match;

      // Remove leading ./ and /
      const cleanPath = val.replace(/^\.\//, '').replace(/^\//, '');

      // Point to the asset proxy
      return `${attr}="/api/proxy/${siteId}/${cleanPath}"`;
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache HTML for 1 hour
      },
    });
  } catch (err) {
    console.error('proxy error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

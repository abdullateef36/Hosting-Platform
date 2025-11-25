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

    // Fetch the asset and re-serve with correct headers
    const res = await fetch(indexUrl);

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch site asset', siteId },
        { status: 502 }
      );
    }

    const body = await res.arrayBuffer();

    return new Response(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline', // Explicitly tell browser to render, not download
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

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(_req: Request, { params }: { params: { siteId: string } }) {
  try {
    const { siteId } = params;

    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId', siteId: null }, { status: 400 });
    }

    const q = query(collection(db, 'sites'), where('siteId', '==', siteId));
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json({ error: 'Site not found', siteId }, { status: 404 });
    }

    const doc = snap.docs[0];
    const data = doc.data() as unknown as Record<string, unknown>;
    const files = (data.files as unknown as Array<Record<string, unknown>>) || [];

    // find index.html
    const indexFile = files.find((f: Record<string, unknown>) => {
      const path = ((f.path || f.name) || '').toString().toLowerCase();
      return path.endsWith('/index.html') || path === 'index.html' || path.endsWith('index.html');
    });

    if (!indexFile) {
      return NextResponse.json({ error: 'index.html not found for site', siteId }, { status: 404 });
    }

    const indexUrl = String((indexFile as Record<string, unknown>)['url'] || '');
    if (!indexUrl) {
      return NextResponse.json({ error: 'index.html has no url', siteId }, { status: 404 });
    }

    // Fetch the asset server-side and stream it back with proper headers
    const res = await fetch(indexUrl);

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch site asset', siteId }, { status: 502 });
    }

    // Force HTML content-type so browsers render the page instead of
    // downloading it. We still stream the upstream body unchanged.
    const body = await res.arrayBuffer();

    const headers: Record<string, string> = {
      'Content-Type': 'text/html; charset=utf-8',
    };

    return new Response(Buffer.from(body), { status: 200, headers });
  } catch (err) {
    console.error('proxy error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

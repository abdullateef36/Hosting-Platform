import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(_req: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params; // ✔️ FIX

    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId', siteId: null }, { status: 400 });
    }

    const q = query(collection(db, 'sites'), where('siteId', '==', siteId));
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json({ error: 'Site not found', siteId }, { status: 404 });
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
      return NextResponse.json({ error: 'index.html not found for site', siteId }, { status: 404 });
    }

    const indexUrl = String(indexFile['url'] || '');
    if (!indexUrl) {
      return NextResponse.json({ error: 'index.html has no url', siteId }, { status: 404 });
    }

    const res = await fetch(indexUrl);

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch site asset', siteId }, { status: 502 });
    }

    const body = await res.arrayBuffer();

    return new Response(Buffer.from(body), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('proxy error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

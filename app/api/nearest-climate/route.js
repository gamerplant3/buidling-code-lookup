import { NextResponse } from 'next/server';

const ENGINE_URL = process.env.ENGINE_URL || 'http://127.0.0.1:8000';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  try {
    const url = `${ENGINE_URL}/nearest-climate?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Engine error' }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: e.message, found: false }, { status: 503 });
  }
}

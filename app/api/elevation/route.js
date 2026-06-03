import { NextResponse } from 'next/server';
import { fetchElevationM } from '@/lib/elevation';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }
  return NextResponse.json(await fetchElevationM(lat, lng));
}

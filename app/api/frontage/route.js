import { NextResponse } from 'next/server';
import { estimateOsmFrontage } from '@/lib/roadFrontage';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const radiusM = Number(searchParams.get('radius') || 150);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }
  try {
    return NextResponse.json(await estimateOsmFrontage(lat, lng, radiusM));
  } catch (e) {
    return NextResponse.json({ found: false, error: e.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { enrichSiteFromCoordinates } from '@/lib/siteEnrich';

/** GET /api/site-enrich?lat=&lng= — climate, elevation, zoning, frontage in one call */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  try {
    const result = await enrichSiteFromCoordinates(lat, lng);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

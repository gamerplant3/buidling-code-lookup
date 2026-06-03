import { NextResponse } from 'next/server';

/**
 * Proxy to Natural Resources Canada Geolocator (free, Canada).
 * https://geolocator.nrcan.gc.ca/api/v1/search
 */
const GEOLOCATOR = 'https://geolocator.nrcan.gc.ca/api/v1/search';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q || q.length < 3) {
    return NextResponse.json(
      { error: 'Query q must be at least 3 characters' },
      { status: 400 }
    );
  }

  const lang = searchParams.get('lang') || 'en';
  const keys = searchParams.get('keys') || 'geonames,nominatim';

  try {
    const url = new URL(GEOLOCATOR);
    url.searchParams.set('q', q);
    url.searchParams.set('lang', lang);
    url.searchParams.set('keys', keys);

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Geolocator HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const features = data?.features || data?.results || [];
    const normalized = (Array.isArray(features) ? features : []).slice(0, 8).map((f, i) => {
      const props = f.properties || f;
      const coords = f.geometry?.coordinates || props.coordinates || [];
      const lng = coords[0] ?? props.longitude ?? props.lng;
      const lat = coords[1] ?? props.latitude ?? props.lat;
      return {
        id: props.id || i,
        name: props.name || props.label || props.place_name || q,
        label: props.label || props.name || q,
        lat: lat != null ? Number(lat) : null,
        lng: lng != null ? Number(lng) : null,
        province: props.province || props.admin1,
        type: props.type || props.category,
      };
    });

    return NextResponse.json({ results: normalized });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

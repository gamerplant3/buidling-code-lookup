/** Open-Meteo elevation (non-commercial; not code-official). */

const ELEVATION_API = 'https://api.open-meteo.com/v1/elevation';

export async function fetchElevationM(lat, lng) {
  const url = new URL(ELEVATION_API);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return { elevationM: null, error: `HTTP ${res.status}` };
  const data = await res.json();
  const elevationM = data?.elevation?.[0];
  return {
    elevationM: elevationM != null ? Math.round(elevationM) : null,
    source: 'open-meteo',
  };
}

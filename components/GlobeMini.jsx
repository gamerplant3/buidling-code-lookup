'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

export default function GlobeMini({ sites, focusLat, focusLng }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const points = sites
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      lat: s.lat,
      lng: s.lng,
      size: s.id ? 0.35 : 0.2,
      color: s.reserveAssessment?.pass
        ? '#3ecf8e'
        : s.reserveAssessment?.pass === false
          ? '#f07178'
          : '#8b9cb3',
    }));

  return (
    <div className="globe-mini">
      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundColor="rgba(0,0,0,0.85)"
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="size"
        pointColor="color"
        pointRadius={0.4}
        width={160}
        height={160}
        animateIn={false}
      />
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export default function MapView({ sites, selectedId, onSelectSite }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [-96, 56],
      zoom: 3.2,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new maplibregl.LngLatBounds();

    sites.forEach((site) => {
      if (site.lng == null || site.lat == null) return;

      const pass = site.reserveAssessment?.pass;
      const color =
        pass === true ? '#3ecf8e' : pass === false ? '#f07178' : '#8b9cb3';

      const el = document.createElement('div');
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '50%';
      el.style.background = color;
      el.style.border = '2px solid #fff';
      el.style.cursor = 'pointer';
      if (site.id === selectedId) {
        el.style.boxShadow = '0 0 0 3px #3d9cf5';
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([site.lng, site.lat])
        .addTo(map);

      el.addEventListener('click', () => onSelectSite?.(site.id));
      markersRef.current.push(marker);
      bounds.extend([site.lng, site.lat]);
    });

    if (sites.length > 0 && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 10 });
    }
  }, [sites, selectedId, onSelectSite]);

  return <div ref={containerRef} className="map-wrap" />;
}

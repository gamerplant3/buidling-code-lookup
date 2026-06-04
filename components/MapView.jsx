'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export default function MapView({ sites, selectedId, onSelectSite, mapFocus }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const focusMarkerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const container = containerRef.current;
    const map = new maplibregl.Map({
      container,
      style: STYLE,
      center: [-96, 56],
      zoom: 3.2,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');
    mapRef.current = map;

    map.on('load', () => map.resize());

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    return () => {
      ro.disconnect();
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

    if (sites.length > 0 && !bounds.isEmpty() && !mapFocus) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 10 });
    }
  }, [sites, selectedId, onSelectSite, mapFocus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (focusMarkerRef.current) {
      focusMarkerRef.current.remove();
      focusMarkerRef.current = null;
    }

    if (mapFocus?.lat == null || mapFocus?.lng == null) return;

    const el = document.createElement('div');
    el.style.width = '16px';
    el.style.height = '16px';
    el.style.background = '#3d9cf5';
    el.style.border = '2px solid #fff';
    el.style.transform = 'rotate(45deg)';
    el.style.boxShadow = '0 0 0 2px rgba(61, 156, 245, 0.5)';
    el.title = mapFocus.label || 'Agent location';

    focusMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([mapFocus.lng, mapFocus.lat])
      .addTo(map);

    map.flyTo({
      center: [mapFocus.lng, mapFocus.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 700,
    });
  }, [mapFocus]);

  return <div ref={containerRef} className="map-wrap" />;
}

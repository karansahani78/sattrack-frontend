import { useEffect, useRef } from 'react';
import L, { type Map as LeafletMap, type Marker, type Polyline } from 'leaflet';
import type { SatellitePosition, TrackPoint } from '../types';
import { useStore } from '../stores/useStore';

// Fix Leaflet default icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface WorldMapProps {
  positions: Record<string, SatellitePosition>;
  trackPoints?: TrackPoint[];
  selectedNoradId?: string | null;
  onSatelliteClick?: (noradId: string) => void;
}

/**
 * Leaflet world map with satellite markers and orbital track.
 *
 * Performance approach: markers are moved (setLatLng) not recreated on each
 * position update. Track polylines are rebuilt only when trackPoints change.
 * Both updates are synchronous DOM ops outside React's render cycle.
 */
export function WorldMap({ positions, trackPoints, selectedNoradId, onSatelliteClick }: WorldMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const trackLinesRef = useRef<Polyline[]>([]);
  const observerMarkerRef = useRef<Marker | null>(null);
  const observerLocation = useStore((s) => s.observerLocation);

  // ── 1. Initialize map once ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: 10,
      worldCopyJump: true,
      zoomControl: true,
    });

    // Dark CartoDB tiles — no API key needed
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors © <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }
    ).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // ── 2. Update satellite markers ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.entries(positions).forEach(([noradId, pos]) => {
      const lat = pos.latitudeDeg;
      const lon = pos.longitudeDeg;
      const isSelected = noradId === selectedNoradId;
      const color = isSelected ? '#06b6d4' : '#3b82f6';
      const size = isSelected ? 14 : 9;

      if (markersRef.current[noradId]) {
        markersRef.current[noradId].setLatLng([lat, lon]);
      } else {
        const icon = L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;
            border-radius:50%;
            background:${color};
            border:2px solid white;
            box-shadow:0 0 ${isSelected ? 12 : 6}px ${color};
          "></div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([lat, lon], { icon })
          .bindTooltip(pos.name || noradId, { direction: 'top', offset: [0, -6] })
          .addTo(map)
          .on('click', () => onSatelliteClick?.(noradId));

        markersRef.current[noradId] = marker;
      }
    });

    // Pan to selected satellite
    if (selectedNoradId && positions[selectedNoradId]) {
      const p = positions[selectedNoradId];
      map.panTo([p.latitudeDeg, p.longitudeDeg], { animate: true, duration: 1 });
    }
  }, [positions, selectedNoradId, onSatelliteClick]);

  // ── 3. Render orbital track ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous track
    trackLinesRef.current.forEach((l) => l.remove());
    trackLinesRef.current = [];

    if (!trackPoints?.length) return;

    // Split at antimeridian crossings to prevent lines wrapping the globe
    const segments: [number, number][][] = [];
    let seg: [number, number][] = [];
    trackPoints.forEach((pt, i) => {
      if (i > 0 && Math.abs(pt.longitudeDeg - trackPoints[i - 1].longitudeDeg) > 180) {
        segments.push(seg);
        seg = [];
      }
      seg.push([pt.latitudeDeg, pt.longitudeDeg]);
    });
    segments.push(seg);

    segments.forEach((s) => {
      if (s.length < 2) return;
      const line = L.polyline(s, {
        color: '#06b6d4',
        weight: 1.5,
        opacity: 0.5,
        dashArray: '6 10',
      }).addTo(map);
      trackLinesRef.current.push(line);
    });
  }, [trackPoints]);

  // ── 4. Observer location marker ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    observerMarkerRef.current?.remove();
    observerMarkerRef.current = null;

    if (!observerLocation) return;

    const icon = L.divIcon({
      html: `<div style="
        width:12px;height:12px;
        border-radius:50%;
        background:#22c55e;
        border:2px solid white;
        box-shadow:0 0 0 4px rgba(34,197,94,0.25);
      "></div>`,
      className: '',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    observerMarkerRef.current = L.marker([observerLocation.lat, observerLocation.lon], { icon })
      .bindTooltip('Observer', { direction: 'top' })
      .addTo(map);

    return () => {
      observerMarkerRef.current?.remove();
    };
  }, [observerLocation]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: 400, background: '#03050a' }}
    />
  );
}

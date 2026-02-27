import { useEffect, useRef, useState } from 'react';
import L, { type Map as LeafletMap, type Marker, type Polyline, type Circle } from 'leaflet';
import type { SatellitePosition, TrackPoint } from '../types';
import { useStore } from '../stores/useStore';

/* ─── fix vite icon paths ──────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface WorldMapProps {
  positions: Record<string, SatellitePosition>;
  trackPoints?: TrackPoint[];
  selectedNoradId?: string | null;
  onSatelliteClick?: (noradId: string) => void;
}

type ViewMode = 'normal' | 'satellite' | 'terrain';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const T = {
  bg:        '#0B1120',
  surface:   'rgba(11,17,32,0.94)',
  border:    'rgba(255,255,255,0.08)',
  borderMid: 'rgba(255,255,255,0.12)',
  accent:    '#3B82F6',
  green:     '#10B981',
  amber:     '#F59E0B',
  red:       '#EF4444',
  text:      '#F1F5F9',
  textSub:   '#94A3B8',
  textMuted: '#475569',
  fontMono:  "'IBM Plex Mono', 'Fira Code', monospace",
  fontSans:  "'IBM Plex Sans', 'Inter', system-ui, sans-serif",
};

/* ─── Satellite color palette (muted, professional) ────────────────────── */
const COLORS = [
  '#60A5FA', '#34D399', '#FBBF24', '#F87171',
  '#A78BFA', '#38BDF8', '#FB923C', '#4ADE80',
  '#E879F9', '#94A3B8',
];
const colorMap: Record<string, string> = {};
let colorCursor = 0;
function getSatColor(id: string) {
  if (!colorMap[id]) colorMap[id] = COLORS[colorCursor++ % COLORS.length];
  return colorMap[id];
}

/* ─── Tile configs ──────────────────────────────────────────────────────── */
const TILES: Record<ViewMode, { url: string; attr: string; maxZoom: number }> = {
  normal: {
    url:     'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    attr:    '© <a href="https://stadiamaps.com">Stadia Maps</a> © <a href="https://openstreetmap.org">OSM</a>',
    maxZoom: 20,
  },
  satellite: {
    url:     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr:    '© <a href="https://www.esri.com">Esri</a>, Maxar, GeoEye, Earthstar Geographics',
    maxZoom: 19,
  },
  terrain: {
    url:     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr:    '© <a href="https://www.esri.com">Esri</a>, HERE, Garmin',
    maxZoom: 19,
  },
};

/* ─── Satellite SVG icon ─────────────────────────────────────────────────
   Removed glow filters and pulsing rings — clean crisp dots with a
   subtle outer ring on selection.
   ─────────────────────────────────────────────────────────────────────── */
function makeSatIcon(color: string, selected: boolean, name: string): L.DivIcon {
  const S  = selected ? 16 : 8;
  const W  = selected ? 40 : 22;
  const H  = W;
  const cx = W / 2, cy = H / 2;

  const outerRing = selected
    ? `<circle cx="${cx}" cy="${cy}" r="${cx - 3}" fill="none" stroke="${color}" stroke-width="1" opacity="0.35"/>`
    : '';

  const crosshair = selected ? `
    <line x1="${cx}" y1="2"  x2="${cx}" y2="${cy - S/2 - 2}" stroke="${color}" stroke-width="0.7" opacity="0.5"/>
    <line x1="${cx}" y1="${cy + S/2 + 2}" x2="${cx}" y2="${H - 2}" stroke="${color}" stroke-width="0.7" opacity="0.5"/>
    <line x1="2"  y1="${cy}" x2="${cx - S/2 - 2}" y2="${cy}" stroke="${color}" stroke-width="0.7" opacity="0.5"/>
    <line x1="${cx + S/2 + 2}" y1="${cy}" x2="${W - 2}" y2="${cy}" stroke="${color}" stroke-width="0.7" opacity="0.5"/>
  ` : '';

  const label = selected ? `
    <div style="
      position:absolute;
      top:${H + 5}px;
      left:50%;
      transform:translateX(-50%);
      white-space:nowrap;
      pointer-events:none;
      font-family:${T.fontMono};
      font-size:9px;
      font-weight:500;
      letter-spacing:0.06em;
      color:${color};
      background:rgba(11,17,32,0.92);
      padding:2px 7px;
      border:1px solid rgba(255,255,255,0.1);
      border-radius:2px;
    ">${name}</div>
  ` : '';

  return L.divIcon({
    html: `<div style="position:relative;width:${W}px;height:${H}px;">
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" overflow="visible">
        ${outerRing}${crosshair}
        <circle cx="${cx}" cy="${cy}" r="${S/2 + (selected ? 4 : 2.5)}"
          fill="${color}" opacity="${selected ? 0.18 : 0.14}"/>
        <circle cx="${cx}" cy="${cy}" r="${S/2}"
          fill="${color}"
          stroke="rgba(255,255,255,${selected ? 0.85 : 0.65})"
          stroke-width="${selected ? 1.75 : 1.25}"/>
      </svg>${label}
    </div>`,
    className: '__sat_icon_host',
    iconSize:   [W, H],
    iconAnchor: [cx, cy],
  });
}

/* ─── Observer icon ─────────────────────────────────────────────────────
   Clean crosshair — no animated radar sweep for a less sci-fi look.
   ─────────────────────────────────────────────────────────────────────── */
function makeObserverIcon(): L.DivIcon {
  const g = T.green;
  return L.divIcon({
    html: `<div style="position:relative;width:30px;height:30px;">
      <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="13" fill="none" stroke="${g}" stroke-width="1" opacity="0.35"/>
        <circle cx="15" cy="15" r="7"  fill="none" stroke="${g}" stroke-width="0.7" opacity="0.25"/>
        <line x1="15" y1="2"  x2="15" y2="7"  stroke="${g}" stroke-width="1.2" opacity="0.7"/>
        <line x1="15" y1="23" x2="15" y2="28" stroke="${g}" stroke-width="1.2" opacity="0.7"/>
        <line x1="2"  y1="15" x2="7"  y2="15" stroke="${g}" stroke-width="1.2" opacity="0.7"/>
        <line x1="23" y1="15" x2="28" y2="15" stroke="${g}" stroke-width="1.2" opacity="0.7"/>
        <circle cx="15" cy="15" r="3.5" fill="${g}" stroke="#0B1120" stroke-width="1.5" opacity="0.9"/>
      </svg>
    </div>`,
    className: '',
    iconSize:   [30, 30],
    iconAnchor: [15, 15],
  });
}

/* ─── Inject map CSS ─────────────────────────────────────────────────────
   Leaflet overrides: professional dark theme, no neon/glow
   ─────────────────────────────────────────────────────────────────────── */
function injectMapStyles() {
  if (document.getElementById('__wm_styles')) return;
  const s = document.createElement('style');
  s.id = '__wm_styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');
    @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');

    .__sat_icon_host { background: none !important; border: none !important; }

    .leaflet-container {
      background: #0a1020 !important;
      font-family: ${T.fontSans} !important;
    }
    .leaflet-tile-pane, .leaflet-tile { background: #0a1020; }

    .leaflet-control-zoom {
      border: 1px solid ${T.border} !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
      border-radius: 4px !important;
      overflow: hidden;
    }
    .leaflet-control-zoom a {
      background: rgba(11,17,32,0.96) !important;
      color: ${T.textSub} !important;
      border: none !important;
      border-bottom: 1px solid ${T.border} !important;
      font-family: ${T.fontSans} !important;
      font-weight: 500 !important;
      font-size: 16px !important;
      width: 30px !important;
      height: 30px !important;
      line-height: 30px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: background 0.15s !important;
    }
    .leaflet-control-zoom a:hover {
      background: rgba(59,130,246,0.12) !important;
      color: ${T.text} !important;
    }
    .leaflet-bar { border: none !important; }

    .leaflet-control-attribution {
      background: rgba(11,17,32,0.88) !important;
      color: ${T.textMuted} !important;
      font-family: ${T.fontMono} !important;
      font-size: 9px !important;
      letter-spacing: 0.03em;
      padding: 3px 8px !important;
      border-top: 1px solid ${T.border} !important;
    }
    .leaflet-control-attribution a { color: ${T.textSub} !important; }

    .leaflet-tooltip {
      background: rgba(11,17,32,0.96) !important;
      border: 1px solid ${T.borderMid} !important;
      border-radius: 4px !important;
      color: ${T.text} !important;
      font-family: ${T.fontMono} !important;
      font-size: 11px !important;
      letter-spacing: 0.04em !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
      padding: 6px 12px !important;
      backdrop-filter: blur(12px) !important;
      white-space: nowrap;
    }
    .leaflet-tooltip::before { display: none !important; }
    .leaflet-tooltip-top { margin-top: -10px !important; }

    .leaflet-popup-content-wrapper {
      background: rgba(11,17,32,0.96) !important;
      border: 1px solid ${T.border} !important;
      border-radius: 4px !important;
      color: ${T.text} !important;
      font-family: ${T.fontSans} !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5) !important;
    }
    .leaflet-popup-tip { background: rgba(11,17,32,0.96) !important; }
    .leaflet-popup-close-button { color: ${T.textSub} !important; }

    @keyframes __wm_locping { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(3);opacity:0} }
    @keyframes __wm_fadein  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
    @keyframes __wm_pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export function WorldMap({ positions, trackPoints, selectedNoradId, onSatelliteClick }: WorldMapProps) {
  const mapRef            = useRef<LeafletMap | null>(null);
  const containerRef      = useRef<HTMLDivElement>(null);
  const markersRef        = useRef<Record<string, Marker>>({});
  const trackRef          = useRef<(Polyline | L.CircleMarker)[]>([]);
  const observerMarkerRef = useRef<Marker | null>(null);
  const horizonRef        = useRef<Circle | null>(null);
  const tileLayerRef      = useRef<L.TileLayer | null>(null);
  const userDotRef        = useRef<Marker | null>(null);
  const userAccRef        = useRef<Marker | null>(null);
  const geocodeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchIdRef        = useRef<number | null>(null);

  const observerLocation = useStore(s => s.observerLocation);

  const [count,         setCount]         = useState(0);
  const [viewMode,      setViewMode]      = useState<ViewMode>('normal');
  const [isTransition,  setIsTransition]  = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [zoomLevel,     setZoomLevel]     = useState(2);
  const [userPos,       setUserPos]       = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const [userLocLabel,  setUserLocLabel]  = useState('');
  const [locStatus,     setLocStatus]     = useState<'idle'|'locating'|'found'|'error'>('idle');

  useEffect(() => { injectMapStyles(); }, []);

  /* ── 1. Init map ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 0], zoom: 2, minZoom: 1, maxZoom: 19,
      worldCopyJump: true, zoomControl: false,
      zoomAnimation: true, zoomAnimationThreshold: 4,
      wheelPxPerZoomLevel: 80,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const cfg = TILES.normal;
    const layer = L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: cfg.maxZoom });
    layer.addTo(map);
    tileLayerRef.current = layer;

    map.on('zoom', () => setZoomLevel(map.getZoom()));

    /* Graticule — subdued */
    const gr = { color: 'rgba(255,255,255,0.04)', weight: 0.5, interactive: false as const };
    for (let lt = -60; lt <= 60; lt += 30) L.polyline([[lt,-180],[lt,180]], gr).addTo(map);
    for (let ln = -150; ln <= 150; ln += 30) L.polyline([[-90,ln],[90,ln]], gr).addTo(map);
    L.polyline([[0,-180],[0,180]],   { color:'rgba(255,255,255,0.1)',  weight:0.8, dashArray:'6 12', interactive:false }).addTo(map);
    L.polyline([[-90,0],[90,0]],     { color:'rgba(255,255,255,0.07)', weight:0.7, dashArray:'6 12', interactive:false }).addTo(map);
    [23.5,-23.5].forEach(lt => L.polyline([[lt,-180],[lt,180]], { color:'rgba(245,158,11,0.12)', weight:0.5, dashArray:'3 8', interactive:false }).addTo(map));
    [66.5,-66.5].forEach(lt => L.polyline([[lt,-180],[lt,180]], { color:'rgba(148,163,184,0.07)', weight:0.4, dashArray:'2 6', interactive:false }).addTo(map));

    mapRef.current = map;
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      tileLayerRef.current = null;
    };
  }, []);

  /* ── 2. Swap tile layer ───────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setIsTransition(true);
    setTimeout(() => setIsTransition(false), 350);
    if (tileLayerRef.current) { map.removeLayer(tileLayerRef.current); tileLayerRef.current = null; }
    const cfg = TILES[viewMode];
    const layer = L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: cfg.maxZoom });
    layer.addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
  }, [viewMode]);

  /* ── 3. Browser GPS ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocStatus('error');
      setUserLocLabel('GPS not available in browser');
      return;
    }
    setLocStatus('locating');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy: acc } = pos.coords;
        setUserPos({ lat, lon, acc });
        setLocStatus('found');
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
          .then(r => r.json())
          .then(data => {
            const a = data?.address;
            if (a) {
              const parts = [
                a.suburb || a.neighbourhood || a.city_district || a.borough,
                a.city || a.town || a.village || a.municipality || a.county,
                a.state || a.region,
                a.country,
              ].filter(Boolean);
              setUserLocLabel(parts.slice(0, 3).join(', '));
            } else {
              setUserLocLabel(`${lat.toFixed(5)}°, ${lon.toFixed(5)}°`);
            }
          })
          .catch(() => setUserLocLabel(`${lat.toFixed(5)}°, ${lon.toFixed(5)}°`));
      },
      (err) => {
        setLocStatus('error');
        const msgs: Record<number, string> = {
          1: 'Location permission denied',
          2: 'Position unavailable',
          3: 'Location request timed out',
        };
        setUserLocLabel(msgs[err.code] || 'Location error');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
    watchIdRef.current = watchId;
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* ── 4. GPS blue dot ──────────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;

    if (userDotRef.current) {
      userDotRef.current
        .setLatLng([userPos.lat, userPos.lon])
        .setTooltipContent(
          `<div style="font-family:${T.fontMono};font-size:10px;color:#60A5FA;letter-spacing:0.06em;margin-bottom:3px;">Your location</div>
           <div style="font-size:9px;color:${T.textSub};">${userLocLabel}</div>
           <div style="font-size:8px;color:${T.textMuted};margin-top:2px;">±${Math.round(userPos.acc)}m accuracy</div>`
        );
      userAccRef.current?.setLatLng([userPos.lat, userPos.lon]);
      return;
    }

    userAccRef.current = L.marker([userPos.lat, userPos.lon], {
      icon: L.divIcon({
        html: `<div style="width:46px;height:46px;border-radius:50%;background:rgba(66,133,244,0.1);border:1px solid rgba(66,133,244,0.25);"></div>`,
        className: '',
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      }),
      zIndexOffset: 900,
      interactive: false,
    }).addTo(map);

    userDotRef.current = L.marker([userPos.lat, userPos.lon], {
      icon: L.divIcon({
        html: `<div style="position:relative;width:20px;height:20px;">
          <div style="position:absolute;inset:-4px;border-radius:50%;background:rgba(66,133,244,0.2);animation:__wm_locping 2.2s ease-out infinite;"></div>
          <div style="position:absolute;inset:0;border-radius:50%;background:#4285f4;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>
          <div style="position:absolute;top:3px;left:4px;width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.6);"></div>
        </div>`,
        className: '',
        iconSize:   [20, 20],
        iconAnchor: [10, 10],
      }),
      zIndexOffset: 1500,
    })
      .bindTooltip(
        `<div style="font-family:${T.fontMono};font-size:10px;color:#60A5FA;letter-spacing:0.06em;margin-bottom:3px;">Your location</div>
         <div style="font-size:9px;color:${T.textSub};">${userLocLabel}</div>
         <div style="font-size:8px;color:${T.textMuted};margin-top:2px;">±${Math.round(userPos.acc)}m accuracy</div>`,
        { direction: 'top', offset: [0, -12] }
      )
      .addTo(map);
  }, [userPos, userLocLabel]);

  /* ── 5. Satellite markers ─────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setCount(Object.keys(positions).length);

    Object.entries(positions).forEach(([id, pos]) => {
      const sel   = id === selectedNoradId;
      const color = getSatColor(id);
      const name  = pos.name || `NORAD-${id}`;
      const icon  = makeSatIcon(color, sel, name);
      const alt   = pos.altitudeKm   ? `${pos.altitudeKm.toFixed(0)} km`    : '';
      const vel   = pos.speedKmPerS  ? `${pos.speedKmPerS.toFixed(2)} km/s` : '';

      const tip =
        `<div style="font-family:${T.fontMono};font-size:10px;color:${color};letter-spacing:0.05em;margin-bottom:3px;">${name}</div>` +
        (alt ? `<div style="font-size:9px;color:${T.textSub};">Alt ${alt}${vel ? ' · ' + vel : ''}</div>` : '');

      if (markersRef.current[id]) {
        markersRef.current[id]
          .setLatLng([pos.latitudeDeg, pos.longitudeDeg])
          .setIcon(icon)
          .setTooltipContent(tip);
      } else {
        const m = L.marker([pos.latitudeDeg, pos.longitudeDeg], {
          icon, zIndexOffset: sel ? 2000 : 100,
        })
          .bindTooltip(tip, { direction: 'top', offset: [0, -12] })
          .addTo(map)
          .on('click', () => onSatelliteClick?.(id));
        markersRef.current[id] = m;
      }
    });

    if (selectedNoradId && positions[selectedNoradId]) {
      const p = positions[selectedNoradId];
      map.panTo([p.latitudeDeg, p.longitudeDeg], { animate: true, duration: 1.0 });
    }
  }, [positions, selectedNoradId, onSatelliteClick]);

  /* ── 6. Orbital track ─────────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    trackRef.current.forEach(l => l.remove());
    trackRef.current = [];
    if (!trackPoints?.length || !selectedNoradId) return;

    const color = getSatColor(selectedNoradId);
    const segs: [number,number][][] = [];
    let seg: [number,number][] = [];
    trackPoints.forEach((pt, i) => {
      if (i > 0 && Math.abs(pt.longitudeDeg - trackPoints[i-1].longitudeDeg) > 180) { segs.push(seg); seg = []; }
      seg.push([pt.latitudeDeg, pt.longitudeDeg]);
    });
    segs.push(seg);

    segs.forEach(s => {
      if (s.length < 2) return;
      const past   = Math.floor(s.length * 0.3);
      const pastS  = s.slice(0, past + 1);
      const futS   = s.slice(past);
      if (pastS.length > 1) {
        trackRef.current.push(L.polyline(pastS, { color, weight: 2, opacity: 0.8, interactive: false }).addTo(map));
        trackRef.current.push(L.polyline(pastS, { color: '#fff', weight: 0.5, opacity: 0.2, interactive: false }).addTo(map));
      }
      if (futS.length > 1) {
        trackRef.current.push(L.polyline(futS, { color, weight: 1.2, opacity: 0.3, dashArray: '5 9', interactive: false }).addTo(map));
      }
    });
    if (trackPoints.length) {
      const f = trackPoints[0];
      trackRef.current.push(L.circleMarker([f.latitudeDeg, f.longitudeDeg], { radius: 3.5, color, fillColor: color, fillOpacity: 0.8, weight: 1.5, opacity: 0.8, interactive: false }).addTo(map));
    }
    if (trackPoints.length > 1) {
      const l = trackPoints[trackPoints.length - 1];
      trackRef.current.push(L.circleMarker([l.latitudeDeg, l.longitudeDeg], { radius: 2.5, color, fillColor: '#fff', fillOpacity: 0.5, weight: 1, opacity: 0.5, interactive: false }).addTo(map));
    }
  }, [trackPoints, selectedNoradId]);

  /* ── 7. Observer marker ───────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    observerMarkerRef.current?.remove();
    horizonRef.current?.remove();
    if (!observerLocation) return;

    observerMarkerRef.current = L.marker(
      [observerLocation.lat, observerLocation.lon],
      { icon: makeObserverIcon(), zIndexOffset: 1000 }
    ).bindTooltip(
      `<div style="font-family:${T.fontMono};font-size:10px;color:${T.green};letter-spacing:0.06em;">Observer</div>
       <div style="font-size:9px;color:${T.textSub};margin-top:2px;">${observerLocation.lat.toFixed(3)}° · ${observerLocation.lon.toFixed(3)}°</div>`,
      { direction: 'top', offset: [0, -16] }
    ).addTo(map);

    horizonRef.current = L.circle(
      [observerLocation.lat, observerLocation.lon],
      { radius: 1_800_000, color: 'rgba(16,185,129,0.25)', fillColor: 'rgba(16,185,129,0.03)', weight: 1, dashArray: '6 10', interactive: false }
    ).addTo(map);

    L.circle(
      [observerLocation.lat, observerLocation.lon],
      { radius: 500_000, color: 'rgba(16,185,129,0.1)', fillColor: 'transparent', weight: 0.5, dashArray: '3 6', interactive: false }
    ).addTo(map);

    return () => { observerMarkerRef.current?.remove(); horizonRef.current?.remove(); };
  }, [observerLocation]);

  /* ── 8. Reverse-geocode selected satellite ────────────────────────────── */
  useEffect(() => {
    if (!selectedNoradId || !positions[selectedNoradId]) { setLocationLabel(''); return; }
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      const pos = positions[selectedNoradId];
      if (!pos) return;
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${pos.latitudeDeg}&lon=${pos.longitudeDeg}&format=json&zoom=5`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const a    = data?.address;
        if (a) {
          const parts = [a.city || a.town || a.county || a.state_district, a.state || a.region, a.country].filter(Boolean);
          setLocationLabel(parts.slice(0, 2).join(', ') || 'Open Ocean');
        } else {
          setLocationLabel('Over open ocean');
        }
      } catch { setLocationLabel(''); }
    }, 4000);
  }, [selectedNoradId, positions]);

  /* ── Fly-to-me ────────────────────────────────────────────────────────── */
  const flyToMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if (userPos) {
      map.flyTo([userPos.lat, userPos.lon], Math.max(zoomLevel, 13), { animate: true, duration: 1.4 });
    } else {
      setLocStatus('locating');
      navigator.geolocation.getCurrentPosition(
        p => {
          setUserPos({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy });
          map.flyTo([p.coords.latitude, p.coords.longitude], 13, { animate: true, duration: 1.4 });
          setLocStatus('found');
        },
        () => setLocStatus('error'),
        { enableHighAccuracy: true, timeout: 12000 }
      );
    }
  };

  const sel    = selectedNoradId ? positions[selectedNoradId] : null;
  const selClr = selectedNoradId ? getSatColor(selectedNoradId) : T.accent;

  const zoomLabel = zoomLevel <= 2 ? 'Global' : zoomLevel <= 4 ? 'Continent'
    : zoomLevel <= 6 ? 'Country' : zoomLevel <= 9 ? 'Region'
    : zoomLevel <= 11 ? 'City' : zoomLevel <= 14 ? 'District' : 'Street';

  const viewBtns: { mode: ViewMode; label: string; desc: string }[] = [
    { mode: 'normal',    label: 'Dark',    desc: 'Dark vector' },
    { mode: 'satellite', label: 'Sat',     desc: 'Aerial imagery' },
    { mode: 'terrain',   label: 'Terrain', desc: 'Topographic' },
  ];

  /* ── Overlay panel shared styles ─────────────────────────────────────── */
  const panelBase: React.CSSProperties = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 5,
    backdropFilter: 'blur(16px)',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: T.fontSans,
    fontSize: 10,
    fontWeight: 500,
    color: T.textMuted,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  };

  const monoStyle: React.CSSProperties = {
    fontFamily: T.fontMono,
    fontSize: 11,
    color: T.textSub,
    letterSpacing: '0.03em',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: T.bg }}>

      {/* Map container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          background: T.bg,
          opacity: isTransition ? 0.7 : 1,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Subtle vignette only */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 400,
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(11,17,32,0.45) 100%)',
      }} />

      {/* ── Live status badge ─────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 460, display: 'flex', alignItems: 'center', gap: 7,
        ...panelBase,
        padding: '5px 14px',
        pointerEvents: 'none',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: T.green,
          display: 'inline-block', animation: '__wm_pulse 2s ease infinite',
        }} />
        <span style={{ ...labelStyle, color: T.textSub }}>Live orbital display</span>
      </div>

      {/* ── View switcher (top-left) ───────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 460,
        animation: '__wm_fadein 0.3s ease',
      }}>
        <div style={{ ...labelStyle, marginBottom: 5, paddingLeft: 1 }}>Map view</div>
        <div style={{
          display: 'flex',
          border: `1px solid ${T.border}`,
          borderRadius: 5,
          overflow: 'hidden',
          background: 'rgba(11,17,32,0.95)',
        }}>
          {viewBtns.map(({ mode, label, desc }, i) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                title={desc}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '6px 14px',
                  cursor: 'pointer',
                  background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                  borderLeft: i > 0 ? `1px solid ${T.border}` : 'none',
                  border: 'none',
                  borderLeft: i > 0 ? `1px solid ${T.border}` : 'none',
                  color: active ? T.accent : T.textMuted,
                  fontFamily: T.fontSans,
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                  letterSpacing: '0.01em',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── My location panel (left) ───────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 80, left: 12, zIndex: 460,
        ...panelBase,
        minWidth: 175,
        borderLeft: `3px solid #4285f4`,
        animation: '__wm_fadein 0.4s ease 0.1s both',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px 7px',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', background: '#4285f4',
              animation: locStatus === 'locating' ? '__wm_pulse 0.9s infinite' : 'none',
            }} />
            <span style={{ ...labelStyle, color: '#4285f4' }}>My location</span>
          </div>
          <button
            onClick={flyToMe}
            title="Fly to my location"
            style={{
              background: 'rgba(66,133,244,0.12)',
              border: `1px solid rgba(66,133,244,0.25)`,
              borderRadius: 3,
              color: '#4285f4',
              cursor: 'pointer',
              padding: '2px 8px',
              fontFamily: T.fontSans,
              fontSize: 11,
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(66,133,244,0.22)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(66,133,244,0.12)')}
          >
            Go to
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 10px' }}>
          {locStatus === 'idle' && (
            <div style={{ ...monoStyle, color: T.textMuted }}>Waiting for GPS…</div>
          )}
          {locStatus === 'locating' && (
            <div style={{ ...monoStyle, color: '#4285f4', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ animation: '__wm_pulse 0.9s infinite' }}>◉</span>
              Acquiring GPS…
            </div>
          )}
          {locStatus === 'error' && (
            <div style={{ ...monoStyle, color: T.red, lineHeight: 1.5 }}>⚠ {userLocLabel}</div>
          )}
          {locStatus === 'found' && userPos && (
            <>
              {userLocLabel && (
                <div style={{
                  fontFamily: T.fontSans, fontSize: 12, color: T.text,
                  marginBottom: 8, lineHeight: 1.5, fontWeight: 500,
                }}>
                  {userLocLabel}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px', marginBottom: 6 }}>
                {[['Lat', `${userPos.lat.toFixed(5)}°`], ['Lon', `${userPos.lon.toFixed(5)}°`]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ ...labelStyle, marginBottom: 2 }}>{k}</div>
                    <div style={{ ...monoStyle, color: T.text, fontSize: 10 }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Accuracy bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <div style={{ flex: 1, height: 3, background: 'rgba(66,133,244,0.12)', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: '#4285f4',
                    width: `${Math.max(5, Math.min(100, 100 - Math.log10(Math.max(userPos.acc, 1)) * 30))}%`,
                    transition: 'width 1s ease',
                    opacity: 0.8,
                  }} />
                </div>
                <span style={{ ...monoStyle, fontSize: 9, color: T.textMuted, whiteSpace: 'nowrap' }}>
                  ±{Math.round(userPos.acc)}m
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Zoom indicator (bottom-right) ─────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 78, right: 11, zIndex: 460,
        ...panelBase,
        padding: '6px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        minWidth: 52,
        pointerEvents: 'none',
      }}>
        <span style={{ ...labelStyle, marginBottom: 2 }}>Zoom</span>
        <span style={{
          fontFamily: T.fontMono,
          fontSize: 16,
          fontWeight: 600,
          color: T.text,
          lineHeight: 1,
        }}>{zoomLevel}</span>
        <span style={{ ...monoStyle, fontSize: 9, color: T.textMuted, marginTop: 2 }}>{zoomLabel}</span>
      </div>

      {/* ── Object count (bottom-left) ────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 460,
        ...panelBase,
        padding: '5px 12px',
        pointerEvents: 'none',
      }}>
        <span style={{ ...monoStyle, color: T.textSub }}>
          <span style={{ color: T.text, fontWeight: 600 }}>{count}</span>
          &nbsp;objects tracked
        </span>
      </div>

      {/* ── Selected satellite panel (bottom-right) ───────────────────── */}
      {sel && selectedNoradId && (
        <div style={{
          position: 'absolute', bottom: 12, right: 48, zIndex: 460,
          ...panelBase,
          borderLeft: `3px solid ${selClr}`,
          padding: '10px 14px',
          minWidth: 220,
          pointerEvents: 'none',
          animation: '__wm_fadein 0.25s ease',
        }}>
          <div style={{
            fontFamily: T.fontMono, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.05em', color: selClr,
            marginBottom: locationLabel ? 8 : 10,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {sel.name || `NORAD ${selectedNoradId}`}
          </div>

          {locationLabel && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              paddingBottom: 7, borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{ fontSize: 10 }}>📍</span>
              <span style={{
                fontFamily: T.fontSans, fontSize: 11, color: T.textSub,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170,
              }}>
                {locationLabel}
              </span>
            </div>
          )}

          {([
            ['Lat', `${(sel.latitudeDeg  || 0).toFixed(3)}°`],
            ['Lon', `${(sel.longitudeDeg || 0).toFixed(3)}°`],
            ['Alt', sel.altitudeKm  ? `${sel.altitudeKm.toFixed(0)} km`    : '—'],
            ['Vel', sel.speedKmPerS ? `${sel.speedKmPerS.toFixed(2)} km/s` : '—'],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{
              display: 'flex', justifyContent: 'space-between', gap: 16,
              padding: '3px 0',
              borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{ ...labelStyle }}>{k}</span>
              <span style={{ ...monoStyle, color: T.text, fontSize: 11, fontWeight: 500 }}>{v}</span>
            </div>
          ))}

          {sel.altitudeKm && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (sel.altitudeKm / 2000) * 100)}%`,
                  background: selClr,
                  borderRadius: 2,
                  transition: 'width 1.2s ease',
                  opacity: 0.75,
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Legend (top-right) ────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 460,
        ...panelBase,
        padding: '8px 12px',
        pointerEvents: 'none',
      }}>
        {[
          { c: 'rgba(255,255,255,0.18)', label: 'Equator',  dashed: false },
          { c: 'rgba(245,158,11,0.4)',   label: 'Tropics',  dashed: true  },
          { c: 'rgba(148,163,184,0.3)',  label: 'Polar',    dashed: true  },
          { c: T.green,                  label: 'Observer', dashed: true  },
          { c: '#4285f4',                label: 'You',      dot: true     },
        ].map(({ c, label, dashed, dot }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {dot
              ? <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, border: '1.5px solid #fff', flexShrink: 0 }} />
              : <div style={{ width: 16, height: 0, borderTop: `${dashed ? '1px dashed' : '1px solid'} ${c}`, flexShrink: 0 }} />
            }
            <span style={{ ...labelStyle, color: T.textMuted }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Transition overlay */}
      {isTransition && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 500,
          background: 'rgba(11,17,32,0.2)',
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease',
        }} />
      )}

      <style>{`
        @keyframes __wm_locping { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(3.2);opacity:0} }
        @keyframes __wm_fadein  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes __wm_pulse   { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>
    </div>
  );
}
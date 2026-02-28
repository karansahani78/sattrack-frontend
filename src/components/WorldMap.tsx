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

/* ─── color palette — uniform steel-blue/cyan tones ─────────── */
const COLORS = ['#00C2FF','#0094C6','#4DA8CC','#6EC6E6','#2A7FAA','#1A6A99','#3AACCC','#5BBAD5','#0080AA','#80D4F0'];
const colorMap: Record<string, string> = {};
let colorCursor = 0;
function getSatColor(id: string) {
  if (!colorMap[id]) colorMap[id] = COLORS[colorCursor++ % COLORS.length];
  return colorMap[id];
}

/* ─── tile configs ──────────────────────────────────────────── */
const TILES: Record<ViewMode, { url: string; attr: string; maxZoom: number }> = {
  normal: {
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    attr: '© <a href="https://stadiamaps.com">Stadia Maps</a> © <a href="https://openstreetmap.org">OSM</a>',
    maxZoom: 20,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: '© <a href="https://www.esri.com">Esri</a>, Maxar, GeoEye, Earthstar Geographics',
    maxZoom: 19,
  },
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr: '© <a href="https://www.esri.com">Esri</a>, HERE, Garmin',
    maxZoom: 19,
  },
};

/* ─── satellite SVG icon ────────────────────────────────────── */
function makeSatIcon(color: string, selected: boolean, name: string): L.DivIcon {
  const S = selected ? 18 : 10;
  const W = selected ? 44 : 26;
  const H = W;
  const cx = W / 2, cy = H / 2;

  const rings = selected ? `
    <circle cx="${cx}" cy="${cy}" r="${cx-2}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.4">
      <animate attributeName="r" from="${cx-10}" to="${cx-1}" dur="2.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.35" to="0" dur="2.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx}" cy="${cy}" r="${cx-4}" fill="none" stroke="${color}" stroke-width="0.6" opacity="0.25">
      <animate attributeName="r" from="${cx-10}" to="${cx-1}" dur="2.2s" begin="0.6s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.25" to="0" dur="2.2s" begin="0.6s" repeatCount="indefinite"/>
    </circle>` : '';

  const cross = selected ? `
    <line x1="${cx}" y1="2" x2="${cx}" y2="${cy-S/2-2}" stroke="${color}" stroke-width="0.7" opacity="0.5"/>
    <line x1="${cx}" y1="${cy+S/2+2}" x2="${cx}" y2="${H-2}" stroke="${color}" stroke-width="0.7" opacity="0.5"/>
    <line x1="2" y1="${cy}" x2="${cx-S/2-2}" y2="${cy}" stroke="${color}" stroke-width="0.7" opacity="0.5"/>
    <line x1="${cx+S/2+2}" y1="${cy}" x2="${W-2}" y2="${cy}" stroke="${color}" stroke-width="0.7" opacity="0.5"/>` : '';

  const label = selected ? `
    <div style="position:absolute;top:${H+5}px;left:50%;transform:translateX(-50%);
      white-space:nowrap;pointer-events:none;
      font-family:'Orbitron',monospace;font-size:9px;font-weight:600;
      letter-spacing:1.5px;color:${color};
      background:rgba(11,15,26,.95);padding:2px 7px;
      border:1px solid ${color}33;">${name}</div>` : '';

  return L.divIcon({
    html: `<div style="position:relative;width:${W}px;height:${H}px;">
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" overflow="visible">
        <defs>
          <filter id="glow${color.slice(1)}${W}">
            <feGaussianBlur stdDeviation="${selected ? 2.5 : 1.2}" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="dot${color.slice(1)}${W}">
            <stop offset="0%" stop-color="#fff" stop-opacity="0.8"/>
            <stop offset="40%" stop-color="${color}" stop-opacity="1"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.75"/>
          </radialGradient>
        </defs>
        ${rings}${cross}
        <circle cx="${cx}" cy="${cy}" r="${S/2+(selected?5:3)}"
          fill="${color}" opacity="${selected?0.15:0.12}"
          filter="url(#glow${color.slice(1)}${W})"/>
        <circle cx="${cx}" cy="${cy}" r="${S/2}"
          fill="url(#dot${color.slice(1)}${W})"
          stroke="rgba(255,255,255,${selected?0.85:0.6})"
          stroke-width="${selected?1.8:1.2}"
          filter="url(#glow${color.slice(1)}${W})"/>
        ${!selected ? `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#fff" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.15;0.5" dur="3s" repeatCount="indefinite"/>
        </circle>` : ''}
      </svg>${label}</div>`,
    className: '__sat_icon_host',
    iconSize:   [W, H],
    iconAnchor: [cx, cy],
  });
}

/* ─── observer icon (radar) ─────────────────────────────────── */
function makeObserverIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="position:relative;width:36px;height:36px;">
      <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="obsG"><stop offset="0%" stop-color="#2E8B57" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#2E8B57" stop-opacity="0"/></radialGradient>
        </defs>
        <circle cx="18" cy="18" r="17" fill="url(#obsG)"/>
        <circle cx="18" cy="18" r="16" fill="none" stroke="#2E8B57" stroke-width="1" opacity="0.45"/>
        <circle cx="18" cy="18" r="10" fill="none" stroke="#2E8B57" stroke-width="0.5" opacity="0.28"/>
        <circle cx="18" cy="18" r="5"  fill="none" stroke="#2E8B57" stroke-width="0.5" opacity="0.35"/>
        <line x1="18" y1="2"  x2="18" y2="6"  stroke="#2E8B57" stroke-width="1" opacity="0.6"/>
        <line x1="18" y1="30" x2="18" y2="34" stroke="#2E8B57" stroke-width="1" opacity="0.6"/>
        <line x1="2"  y1="18" x2="6"  y2="18" stroke="#2E8B57" stroke-width="1" opacity="0.6"/>
        <line x1="30" y1="18" x2="34" y2="18" stroke="#2E8B57" stroke-width="1" opacity="0.6"/>
        <line x1="18" y1="18" x2="18" y2="3" stroke="#2E8B57" stroke-width="1.5" opacity="0.8" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="4s" repeatCount="indefinite"/>
        </line>
        <circle cx="18" cy="18" r="4" fill="#2E8B57" stroke="#fff" stroke-width="1.5"
          style="filter:drop-shadow(0 0 5px #2E8B57)"/>
        <circle cx="18" cy="18" r="4" fill="#2E8B57" opacity="0.35">
          <animate attributeName="r" values="4;7;4" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.35;0;0.35" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      </svg></div>`,
    className: '',
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
  });
}

/* ─── timestamp extractor (safe — handles any field name) ────── */
function extractTime(pt: TrackPoint): string {
  const raw =
    (pt as any).time       ??
    (pt as any).timestamp  ??
    (pt as any).computedAt ??
    (pt as any).date       ??
    undefined;
  if (!raw) return '';
  try { return new Date(raw).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'; }
  catch { return ''; }
}

/* ─── inject CSS ────────────────────────────────────────────── */
function injectMapStyles() {
  if (document.getElementById('__wm_styles')) return;
  const s = document.createElement('style');
  s.id = '__wm_styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600&family=Share+Tech+Mono&display=swap');
    @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');

    .__sat_icon_host { background:none!important;border:none!important; }
    .leaflet-container { background:#0B0F1A!important;font-family:'Share Tech Mono',monospace!important; }
    .leaflet-tile-pane,.leaflet-tile { background:#0B0F1A; }

    .leaflet-control-zoom {
      border:1px solid rgba(0,194,255,.18)!important;
      box-shadow:none!important;border-radius:2px!important;
    }
    .leaflet-control-zoom a {
      background:rgba(11,15,26,.97)!important;color:#00C2FF!important;
      border:none!important;border-bottom:1px solid rgba(0,194,255,.1)!important;
      font-family:'Orbitron',monospace!important;font-weight:700!important;font-size:16px!important;
      width:32px!important;height:32px!important;line-height:32px!important;
      display:flex!important;align-items:center!important;justify-content:center!important;
      transition:background .2s!important;border-radius:0!important;
    }
    .leaflet-control-zoom a:hover {
      background:rgba(0,194,255,.1)!important;color:#fff!important;
    }
    .leaflet-bar { border:none!important;border-radius:2px!important;overflow:hidden; }
    .leaflet-control-attribution {
      background:rgba(11,15,26,.88)!important;color:rgba(0,194,255,.22)!important;
      font-family:'Share Tech Mono',monospace!important;font-size:9px!important;
      letter-spacing:.5px;padding:3px 8px!important;
    }
    .leaflet-control-attribution a { color:rgba(0,194,255,.4)!important; }
    .leaflet-tooltip {
      background:rgba(11,15,26,.98)!important;border:1px solid rgba(0,194,255,.22)!important;
      border-radius:1px!important;color:#00C2FF!important;
      font-family:'Share Tech Mono',monospace!important;font-size:11px!important;
      letter-spacing:1.5px!important;box-shadow:none!important;
      padding:6px 12px!important;white-space:nowrap;
    }
    .leaflet-tooltip::before { display:none!important; }
    .leaflet-tooltip-top { margin-top:-10px!important; }
    .leaflet-popup-content-wrapper {
      background:rgba(11,15,26,.98)!important;border:1px solid rgba(0,194,255,.18)!important;
      border-radius:2px!important;color:#CBD9E8!important;font-family:'Share Tech Mono',monospace!important;
    }
    .leaflet-popup-tip { background:rgba(11,15,26,.98)!important; }
    .leaflet-popup-close-button { color:#00C2FF!important; }

    /* ── track-line tooltip styles ──────────────────────────── */
    .trk-tip-past {
      background:rgba(11,15,26,.97)!important;
      border:1px solid rgba(0,194,255,.18)!important;
      border-left:2px solid rgba(0,194,255,.75)!important;
      border-radius:1px!important;padding:8px 14px!important;
      box-shadow:none!important;min-width:200px;
    }
    .trk-tip-past::before { display:none!important; }
    .trk-tip-future {
      background:rgba(11,15,26,.97)!important;
      border:1px solid rgba(0,194,255,.1)!important;
      border-left:2px solid rgba(0,194,255,.35)!important;
      border-radius:1px!important;padding:8px 14px!important;
      box-shadow:none!important;min-width:200px;
    }
    .trk-tip-future::before { display:none!important; }
    .trk-tip-node {
      background:rgba(11,15,26,.97)!important;
      border:1px solid rgba(0,194,255,.2)!important;
      border-radius:1px!important;padding:6px 12px!important;
      box-shadow:none!important;
    }
    .trk-tip-node::before { display:none!important; }

    @keyframes __blink   { 0%,100%{opacity:1} 50%{opacity:.25} }
    @keyframes __fadeIn  { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
    @keyframes __pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }
    @keyframes __locPing { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(3);opacity:0} }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */
export function WorldMap({ positions, trackPoints, selectedNoradId, onSatelliteClick }: WorldMapProps) {
  const mapRef             = useRef<LeafletMap | null>(null);
  const containerRef       = useRef<HTMLDivElement>(null);
  const markersRef         = useRef<Record<string, Marker>>({});
  const trackRef           = useRef<(Polyline | L.CircleMarker | Marker)[]>([]);
  const observerMarkerRef  = useRef<Marker | null>(null);
  const horizonRef         = useRef<Circle | null>(null);
  const tileLayerRef       = useRef<L.TileLayer | null>(null);
  const userDotRef         = useRef<Marker | null>(null);
  const userAccRef         = useRef<Marker | null>(null);
  const geocodeTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchIdRef         = useRef<number | null>(null);

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

  /* ── 1. Init map ──────────────────────────────────────────── */
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

    /* graticule */
    const gr = { color: 'rgba(0,194,255,.05)', weight: 0.5, interactive: false as const };
    for (let lt = -60; lt <= 60; lt += 30) L.polyline([[lt,-180],[lt,180]], gr).addTo(map);
    for (let ln = -150; ln <= 150; ln += 30) L.polyline([[-90,ln],[90,ln]], gr).addTo(map);
    L.polyline([[0,-180],[0,180]], { color:'rgba(0,194,255,.18)', weight:1, dashArray:'6 12', interactive:false }).addTo(map);
    L.polyline([[-90,0],[90,0]], { color:'rgba(0,194,255,.12)', weight:1, dashArray:'6 12', interactive:false }).addTo(map);
    [23.5,-23.5].forEach(lt => L.polyline([[lt,-180],[lt,180]], { color:'rgba(184,115,51,.08)', weight:0.6, dashArray:'3 8', interactive:false }).addTo(map));
    [66.5,-66.5].forEach(lt => L.polyline([[lt,-180],[lt,180]], { color:'rgba(0,150,200,.06)', weight:0.5, dashArray:'2 6', interactive:false }).addTo(map));

    mapRef.current = map;
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      tileLayerRef.current = null;
    };
  }, []);

  /* ── 2. Swap tile layer on view change ───────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setIsTransition(true);
    setTimeout(() => setIsTransition(false), 450);
    if (tileLayerRef.current) { map.removeLayer(tileLayerRef.current); tileLayerRef.current = null; }
    const cfg = TILES[viewMode];
    const layer = L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: cfg.maxZoom });
    layer.addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
  }, [viewMode]);

  /* ── 3. Browser GPS (high-accuracy watch) ────────────────── */
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

  /* ── 4. Draw/update GPS blue dot on map ──────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;

    if (userDotRef.current) {
      userDotRef.current
        .setLatLng([userPos.lat, userPos.lon])
        .setTooltipContent(
          `<div style="font-family:'Orbitron',monospace;font-size:10px;color:#4285f4;letter-spacing:2px;margin-bottom:3px;">YOUR LOCATION</div>
           <div style="font-size:9px;color:rgba(140,180,210,.8);letter-spacing:1px;">${userLocLabel}</div>
           <div style="font-size:8px;color:rgba(100,140,180,.45);margin-top:2px;">±${Math.round(userPos.acc)}m accuracy</div>`
        );
      userAccRef.current?.setLatLng([userPos.lat, userPos.lon]);
      return;
    }

    userAccRef.current = L.marker([userPos.lat, userPos.lon], {
      icon: L.divIcon({
        html: `<div style="width:50px;height:50px;border-radius:50%;background:rgba(66,133,244,0.08);border:1px solid rgba(66,133,244,0.25);"></div>`,
        className: '',
        iconSize: [50, 50],
        iconAnchor: [25, 25],
      }),
      zIndexOffset: 900,
      interactive: false,
    }).addTo(map);

    userDotRef.current = L.marker([userPos.lat, userPos.lon], {
      icon: L.divIcon({
        html: `<div style="position:relative;width:22px;height:22px;">
          <div style="position:absolute;inset:-5px;border-radius:50%;background:rgba(66,133,244,0.18);animation:__locPing 2.5s ease-out infinite;"></div>
          <div style="position:absolute;inset:0;border-radius:50%;background:#4285f4;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>
          <div style="position:absolute;top:3px;left:4px;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.55);"></div>
        </div>`,
        className: '',
        iconSize:   [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 1500,
    })
      .bindTooltip(
        `<div style="font-family:'Orbitron',monospace;font-size:10px;color:#4285f4;letter-spacing:2px;margin-bottom:3px;">YOUR LOCATION</div>
         <div style="font-size:9px;color:rgba(140,180,210,.8);letter-spacing:1px;">${userLocLabel}</div>
         <div style="font-size:8px;color:rgba(100,140,180,.45);margin-top:2px;">±${Math.round(userPos.acc)}m accuracy</div>`,
        { direction: 'top', offset: [0, -14] }
      )
      .addTo(map);
  }, [userPos, userLocLabel]);

  /* ── 5. Satellite markers ────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setCount(Object.keys(positions).length);
    Object.entries(positions).forEach(([id, pos]) => {
      const sel   = id === selectedNoradId;
      const color = getSatColor(id);
      const name  = pos.name || `NORAD-${id}`;
      const icon  = makeSatIcon(color, sel, name);
      const alt   = pos.altitudeKm ? `${pos.altitudeKm.toFixed(0)} km` : '';
      const vel   = pos.speedKmPerS ? `${pos.speedKmPerS.toFixed(2)} km/s` : '';
      const tip =
        `<div style="font-family:'Orbitron',monospace;font-size:10px;color:${color};letter-spacing:2px;margin-bottom:4px;">${name}</div>` +
        (alt ? `<div style="font-size:9px;color:rgba(140,180,210,.65);letter-spacing:1px;">ALT ${alt}${vel?' · '+vel:''}</div>` : '');
      if (markersRef.current[id]) {
        markersRef.current[id]
          .setLatLng([pos.latitudeDeg, pos.longitudeDeg])
          .setIcon(icon)
          .setTooltipContent(tip);
      } else {
        const m = L.marker([pos.latitudeDeg, pos.longitudeDeg], {
          icon, zIndexOffset: sel ? 2000 : 100,
        })
          .bindTooltip(tip, { direction: 'top', offset: [0, -14] })
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

  /* ── 6. Orbital track ────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    trackRef.current.forEach(l => map.removeLayer(l));
    trackRef.current = [];

    if (!trackPoints?.length || !selectedNoradId) return;

    const color    = getSatColor(selectedNoradId);
    const nPts     = trackPoints.length;
    const splitIdx = Math.floor(nPts * 0.5);

    /* ── read timestamps non-destructively from whatever field the backend uses */
    const timeFirst  = extractTime(trackPoints[0]);
    const timeSplit  = extractTime(trackPoints[splitIdx]);
    const timeLast   = extractTime(trackPoints[nPts - 1]);

    /* helper: past tooltip HTML */
    const pastTipHtml = `
      <div style="font-family:'Orbitron',monospace;font-size:9px;letter-spacing:3px;color:${color};margin-bottom:6px;">◀ PAST ORBIT</div>
      ${timeFirst ? `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;color:rgba(140,180,210,.5);margin-bottom:2px;">FROM &nbsp;<span style="color:rgba(200,225,245,.8)">${timeFirst}</span></div>` : ''}
      ${timeSplit ? `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;color:rgba(140,180,210,.5);">&nbsp;&nbsp;TO &nbsp;<span style="color:rgba(200,225,245,.8)">${timeSplit}</span></div>` : ''}
    `;

    /* helper: future tooltip HTML */
    const futureTipHtml = `
      <div style="font-family:'Orbitron',monospace;font-size:9px;letter-spacing:3px;color:${color};opacity:.65;margin-bottom:6px;">▶ FUTURE PATH</div>
      ${timeSplit ? `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;color:rgba(140,180,210,.4);margin-bottom:2px;">FROM &nbsp;<span style="color:rgba(200,225,245,.65)">${timeSplit}</span></div>` : ''}
      ${timeLast  ? `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;color:rgba(140,180,210,.4);">&nbsp;&nbsp;TO &nbsp;<span style="color:rgba(200,225,245,.65)">${timeLast}</span></div>` : ''}
    `;

    function splitAtAntimeridian(pts: TrackPoint[]): [number, number][][] {
      const segs: [number, number][][] = [];
      let seg: [number, number][] = [];
      pts.forEach((pt, i) => {
        if (i > 0 && Math.abs(pt.longitudeDeg - pts[i - 1].longitudeDeg) > 180) {
          if (seg.length > 1) segs.push(seg);
          seg = [];
        }
        seg.push([pt.latitudeDeg, pt.longitudeDeg]);
      });
      if (seg.length > 1) segs.push(seg);
      return segs;
    }

    const pastPts   = trackPoints.slice(0, splitIdx + 1);
    const futurePts = trackPoints.slice(splitIdx);

    /* ── PAST: glow halo (non-interactive, visual) ── */
    splitAtAntimeridian(pastPts).forEach(seg => {
      if (seg.length < 2) return;
      trackRef.current.push(L.polyline(seg, {
        color, weight: 6, opacity: 0.12, interactive: false, lineCap: 'round', lineJoin: 'round',
      }).addTo(map));
    });

    /* ── PAST: solid visible line (non-interactive) ── */
    splitAtAntimeridian(pastPts).forEach(seg => {
      if (seg.length < 2) return;
      trackRef.current.push(L.polyline(seg, {
        color, weight: 2, opacity: 0.9, interactive: false, lineCap: 'round', lineJoin: 'round',
      }).addTo(map));
    });

    /* ── PAST: breadcrumb dots ── */
    pastPts.forEach((pt, i) => {
      if (i % 8 !== 0) return;
      const ageFraction = i / pastPts.length;
      const opacity = 0.2 + ageFraction * 0.5;
      const radius  = 1.2 + ageFraction * 1.2;
      trackRef.current.push(L.circleMarker([pt.latitudeDeg, pt.longitudeDeg], {
        radius, color, fillColor: color, fillOpacity: opacity,
        weight: 0, opacity, interactive: false,
      }).addTo(map));
    });

    /* ── PAST: invisible wide hit-area → shows tooltip on hover ── */
    splitAtAntimeridian(pastPts).forEach(seg => {
      if (seg.length < 2) return;
      const overlay = L.polyline(seg, { color, weight: 20, opacity: 0, interactive: true });
      overlay.bindTooltip(pastTipHtml, {
        sticky: true, direction: 'top', offset: [0, -12], className: 'trk-tip-past',
      });
      overlay.addTo(map);
      trackRef.current.push(overlay as unknown as Polyline);
    });

    /* ── FUTURE: glow halo (non-interactive, visual) ── */
    splitAtAntimeridian(futurePts).forEach(seg => {
      if (seg.length < 2) return;
      trackRef.current.push(L.polyline(seg, {
        color, weight: 4, opacity: 0.06, interactive: false, lineCap: 'round',
      }).addTo(map));
    });

    /* ── FUTURE: dashed visible line (non-interactive) ── */
    splitAtAntimeridian(futurePts).forEach(seg => {
      if (seg.length < 2) return;
      trackRef.current.push(L.polyline(seg, {
        color, weight: 1.5, opacity: 0.55, dashArray: '5 9', interactive: false, lineCap: 'round',
      }).addTo(map));
    });

    /* ── FUTURE: direction arrows ── */
    futurePts.forEach((pt, i) => {
      if (i === 0 || i % 12 !== 0 || i >= futurePts.length - 1) return;
      const prev = futurePts[i - 1];
      if (Math.abs(pt.longitudeDeg - prev.longitudeDeg) > 180) return;
      const angle = Math.atan2(pt.longitudeDeg - prev.longitudeDeg, pt.latitudeDeg - prev.latitudeDeg) * (180 / Math.PI);
      trackRef.current.push(
        L.marker([pt.latitudeDeg, pt.longitudeDeg], {
          icon: L.divIcon({
            html: `<div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:9px solid ${color};opacity:0.6;transform:rotate(${angle}deg);transform-origin:center center;"></div>`,
            className: '', iconSize: [8, 9], iconAnchor: [4, 4],
          }),
          interactive: false, zIndexOffset: -100,
        }).addTo(map)
      );
    });

    /* ── FUTURE: invisible wide hit-area → shows tooltip on hover ── */
    splitAtAntimeridian(futurePts).forEach(seg => {
      if (seg.length < 2) return;
      const overlay = L.polyline(seg, { color, weight: 20, opacity: 0, interactive: true });
      overlay.bindTooltip(futureTipHtml, {
        sticky: true, direction: 'top', offset: [0, -12], className: 'trk-tip-future',
      });
      overlay.addTo(map);
      trackRef.current.push(overlay as unknown as Polyline);
    });

    /* ── endpoint circle markers with tooltips ── */
    const startTip =
      `<div style="font-family:'Orbitron',monospace;font-size:9px;letter-spacing:2px;color:${color};margin-bottom:3px;">◀ TRACK START</div>` +
      (timeFirst ? `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(200,225,245,.75);">${timeFirst}</div>` : '');

    const nowTip =
      `<div style="font-family:'Orbitron',monospace;font-size:9px;letter-spacing:2px;color:${color};margin-bottom:3px;">◉ CURRENT POSITION</div>` +
      (timeSplit ? `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(200,225,245,.8);">${timeSplit}</div>` : '');

    const endTip =
      `<div style="font-family:'Orbitron',monospace;font-size:9px;letter-spacing:2px;color:${color};opacity:.65;margin-bottom:3px;">▶ TRACK END</div>` +
      (timeLast ? `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(200,225,245,.65);">${timeLast}</div>` : '');

    const startMarker = L.circleMarker(
      [trackPoints[0].latitudeDeg, trackPoints[0].longitudeDeg],
      { radius: 3.5, color, fillColor: 'transparent', fillOpacity: 0, weight: 1.2, opacity: 0.4, interactive: true }
    ).bindTooltip(startTip, { direction: 'top', offset: [0, -8], className: 'trk-tip-node' }).addTo(map);
    trackRef.current.push(startMarker);

    const nowMarker = L.circleMarker(
      [trackPoints[splitIdx].latitudeDeg, trackPoints[splitIdx].longitudeDeg],
      { radius: 6, color, fillColor: color, fillOpacity: 0.1, weight: 1.2, opacity: 0.6, interactive: true }
    ).bindTooltip(nowTip, { direction: 'top', offset: [0, -10], className: 'trk-tip-node' }).addTo(map);
    trackRef.current.push(nowMarker);

    const endMarker = L.circleMarker(
      [trackPoints[nPts - 1].latitudeDeg, trackPoints[nPts - 1].longitudeDeg],
      { radius: 4.5, color, fillColor: color, fillOpacity: 0.12, weight: 1.2, opacity: 0.5, interactive: true }
    ).bindTooltip(endTip, { direction: 'top', offset: [0, -8], className: 'trk-tip-node' }).addTo(map);
    trackRef.current.push(endMarker);

  }, [trackPoints, selectedNoradId]);

  /* ── 7. Observer marker ──────────────────────────────────── */
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
      `<div style="font-family:'Orbitron',monospace;font-size:10px;color:#2E8B57;letter-spacing:3px;">OBSERVER</div>
       <div style="font-size:9px;color:rgba(46,139,87,.6);letter-spacing:1px;margin-top:2px;">
         ${observerLocation.lat.toFixed(3)}° · ${observerLocation.lon.toFixed(3)}°</div>`,
      { direction: 'top', offset: [0, -18] }
    ).addTo(map);

    horizonRef.current = L.circle(
      [observerLocation.lat, observerLocation.lon],
      { radius:1_800_000, color:'rgba(46,139,87,.22)', fillColor:'rgba(46,139,87,.03)', weight:1, dashArray:'6 10', interactive:false }
    ).addTo(map);

    L.circle(
      [observerLocation.lat, observerLocation.lon],
      { radius:500_000, color:'rgba(46,139,87,.09)', fillColor:'transparent', weight:0.5, dashArray:'3 6', interactive:false }
    ).addTo(map);

    return () => { observerMarkerRef.current?.remove(); horizonRef.current?.remove(); };
  }, [observerLocation]);

  /* ── 8. Reverse-geocode selected satellite ───────────────── */
  useEffect(() => {
    if (!selectedNoradId || !positions[selectedNoradId]) { setLocationLabel(''); return; }
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      const pos = positions[selectedNoradId];
      if (!pos) return;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${pos.latitudeDeg}&lon=${pos.longitudeDeg}&format=json&zoom=5`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (data?.error || !data?.address) {
          setLocationLabel('Over open ocean');
          return;
        }
        const a = data.address;
        const parts = [
          a.city || a.town || a.county || a.state_district,
          a.state || a.region,
          a.country,
        ].filter(Boolean);
        setLocationLabel(parts.slice(0, 2).join(', ') || 'Over open ocean');
      } catch {
        setLocationLabel(prev => prev || 'Over open ocean');
      }
    }, 4000);
  }, [selectedNoradId, positions]);

  /* ── fly-to-me handler ────────────────────────────────────── */
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
          map.flyTo([p.coords.latitude, p.coords.longitude], 13, { animate:true, duration:1.4 });
          setLocStatus('found');
        },
        () => setLocStatus('error'),
        { enableHighAccuracy: true, timeout: 12000 }
      );
    }
  };

  const sel    = selectedNoradId ? positions[selectedNoradId] : null;
  const selClr = selectedNoradId ? getSatColor(selectedNoradId) : '#00C2FF';

  const zoomLabel = zoomLevel <= 2 ? 'GLOBAL' : zoomLevel <= 4 ? 'CONTINENT'
    : zoomLevel <= 6 ? 'COUNTRY' : zoomLevel <= 9 ? 'REGION'
    : zoomLevel <= 11 ? 'CITY' : zoomLevel <= 14 ? 'DISTRICT' : 'STREET';

  const viewBtns: { mode: ViewMode; label: string; icon: string; color: string; desc: string }[] = [
    { mode: 'normal',    label: 'DARK',    icon: '◈', color: '#00C2FF', desc: 'Dark vector' },
    { mode: 'satellite', label: 'SAT',     icon: '⊛', color: '#4DA8CC', desc: 'Aerial imagery' },
    { mode: 'terrain',   label: 'TERRAIN', icon: '⬡', color: '#B87333', desc: 'Topographic' },
  ];

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', borderRadius:'inherit', overflow:'hidden', background:'#0B0F1A' }}>

      <div ref={containerRef} style={{ width:'100%', height:'100%', background:'#0B0F1A', opacity: isTransition ? 0.6 : 1, transition:'opacity 0.4s ease' }} />

      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:400, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,194,255,.008) 2px,rgba(0,194,255,.008) 4px)', opacity: viewMode === 'satellite' ? 0.25 : 1 }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:401, background:'radial-gradient(ellipse at center,transparent 55%,rgba(11,15,26,.55) 100%)' }} />

      {[
        { top:8,    left:8,   borderTop:'1.5px solid rgba(0,194,255,.35)',    borderLeft:'1.5px solid rgba(0,194,255,.35)' },
        { top:8,    right:8,  borderTop:'1.5px solid rgba(0,194,255,.35)',    borderRight:'1.5px solid rgba(0,194,255,.35)' },
        { bottom:8, left:8,   borderBottom:'1.5px solid rgba(0,194,255,.35)', borderLeft:'1.5px solid rgba(0,194,255,.35)' },
        { bottom:8, right:8,  borderBottom:'1.5px solid rgba(0,194,255,.35)', borderRight:'1.5px solid rgba(0,194,255,.35)' },
      ].map((s,i) => <div key={i} style={{ position:'absolute', width:16, height:16, pointerEvents:'none', zIndex:460, ...s }} />)}

      <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', zIndex:460, display:'flex', alignItems:'center', gap:8, background:'rgba(11,15,26,.95)', border:'1px solid rgba(0,194,255,.18)', padding:'5px 18px', pointerEvents:'none' }}>
        <span style={{ width:5, height:5, borderRadius:'50%', background:'#2E8B57', display:'inline-block', animation:'__blink 1.5s infinite' }} />
        <span style={{ fontFamily:"'Orbitron',monospace", fontSize:9, letterSpacing:4, color:'rgba(0,194,255,.8)' }}>LIVE ORBITAL DISPLAY</span>
      </div>

      <div style={{ position:'absolute', top:12, left:12, zIndex:460, animation:'__fadeIn 0.4s ease' }}>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:2, color:'rgba(0,194,255,.28)', marginBottom:4, paddingLeft:2 }}>MAP VIEW</div>
        <div style={{ display:'flex', gap:3 }}>
          {viewBtns.map(({ mode, label, icon, color, desc }) => {
            const active = viewMode === mode;
            return (
              <button key={mode} title={desc} onClick={() => setViewMode(mode)} style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, width:56, height:52, cursor:'pointer', position:'relative', background: active ? 'rgba(0,194,255,.06)' : 'rgba(11,15,26,.95)', border: `1px solid ${active ? color : 'rgba(0,194,255,.12)'}`, borderRadius:2, color: active ? color : 'rgba(0,194,255,.35)', transition:'all 0.2s ease', padding:0 }}>
                <span style={{ fontSize:14, lineHeight:1, opacity:active?1:0.45 }}>{icon}</span>
                <span style={{ fontFamily:"'Orbitron',monospace", fontSize:7, letterSpacing:1, fontWeight:700, lineHeight:1, opacity:active?1:0.4 }}>{label}</span>
                {active && <span style={{ position:'absolute', bottom:2, width:20, height:1, background:color, borderRadius:1 }} />}
              </button>
            );
          })}
        </div>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1, color: viewBtns.find(b=>b.mode===viewMode)?.color, opacity:0.4, paddingLeft:2, marginTop:5, transition:'color 0.3s' }}>{viewBtns.find(b=>b.mode===viewMode)?.desc}</div>
      </div>

      <div style={{ position:'absolute', top:138, left:12, zIndex:460, background:'rgba(11,15,26,.95)', border:'1px solid rgba(66,133,244,.18)', borderLeft:'2px solid rgba(66,133,244,.4)', minWidth:178, animation:'__fadeIn 0.5s ease 0.15s both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px 6px', borderBottom:'1px solid rgba(66,133,244,.1)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#4285f4', animation: locStatus==='locating' ? '__pulse 0.9s infinite' : 'none' }} />
            <span style={{ fontFamily:"'Orbitron',monospace", fontSize:8, letterSpacing:2, color:'#4285f4' }}>MY LOCATION</span>
          </div>
          <button onClick={flyToMe} title="Fly to my location on map" style={{ background:'rgba(66,133,244,.1)', border:'1px solid rgba(66,133,244,.25)', borderRadius:2, color:'#4285f4', cursor:'pointer', padding:'2px 8px', fontFamily:"'Orbitron',monospace", fontSize:8, letterSpacing:1, transition:'background 0.2s', display:'flex', alignItems:'center', gap:3 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(66,133,244,.2)')} onMouseLeave={e => (e.currentTarget.style.background = 'rgba(66,133,244,.1)')}>⊕ GOTO</button>
        </div>
        <div style={{ padding:'8px 10px' }}>
          {locStatus === 'idle' && <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'rgba(100,140,180,.45)', letterSpacing:0.5 }}>Waiting for GPS…</div>}
          {locStatus === 'locating' && <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'rgba(66,133,244,.6)', display:'flex', alignItems:'center', gap:6 }}><span style={{ animation:'__blink 0.9s infinite' }}>◉</span> Acquiring GPS signal…</div>}
          {locStatus === 'error' && <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'rgba(180,80,80,.7)', letterSpacing:0.5, lineHeight:1.5 }}>⚠ {userLocLabel}</div>}
          {locStatus === 'found' && userPos && (
            <>
              {userLocLabel && <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9.5, letterSpacing:0.5, color:'rgba(180,210,240,.85)', marginBottom:7, lineHeight:1.55 }}>{userLocLabel}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 10px', marginBottom:5 }}>
                {[['LAT', `${userPos.lat.toFixed(5)}°`], ['LON', `${userPos.lon.toFixed(5)}°`]].map(([k,v]) => (
                  <div key={k}>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:7, letterSpacing:1, color:'rgba(66,133,244,.45)', marginBottom:1 }}>{k}</div>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'#CBD9E8', letterSpacing:0.5 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                <div style={{ flex:1, height:1.5, background:'rgba(66,133,244,.12)', borderRadius:1 }}>
                  <div style={{ height:'100%', borderRadius:1, background:'#4285f4', width:`${Math.max(5, Math.min(100, 100 - Math.log10(Math.max(userPos.acc,1)) * 30))}%`, transition:'width 1s ease' }} />
                </div>
                <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:'rgba(66,133,244,.45)', letterSpacing:0.5, whiteSpace:'nowrap' }}>±{Math.round(userPos.acc)}m</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ position:'absolute', bottom:82, right:11, zIndex:460, background:'rgba(11,15,26,.92)', border:'1px solid rgba(0,194,255,.1)', padding:'5px 10px', pointerEvents:'none', display:'flex', flexDirection:'column', alignItems:'center', minWidth:52 }}>
        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:7, letterSpacing:1.5, color:'rgba(0,194,255,.28)', marginBottom:1 }}>ZOOM</span>
        <span style={{ fontFamily:"'Orbitron',monospace", fontSize:14, fontWeight:700, color:'rgba(0,194,255,.7)', lineHeight:1 }}>{zoomLevel}</span>
        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:7, color:'rgba(0,194,255,.25)', letterSpacing:0.5, marginTop:2 }}>{zoomLabel}</span>
      </div>

      <div style={{ position:'absolute', bottom:36, left:12, zIndex:460, background:'rgba(11,15,26,.92)', border:'1px solid rgba(0,194,255,.12)', padding:'5px 12px', pointerEvents:'none' }}>
        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:2, color:'rgba(0,194,255,.55)' }}>
          {count} <span style={{ color:'rgba(0,194,255,.25)' }}>OBJECTS TRACKED</span>
        </span>
      </div>

      {sel && selectedNoradId && (
        <div style={{ position:'absolute', bottom:36, right:48, zIndex:460, background:'rgba(11,15,26,.97)', border:`1px solid ${selClr}22`, borderLeft:`2px solid ${selClr}`, padding:'10px 14px', pointerEvents:'none', minWidth:225, animation:'__fadeIn 0.3s ease' }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:10, fontWeight:600, letterSpacing:2, color:selClr, marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sel.name || `NORAD ${selectedNoradId}`}</div>
          {locationLabel && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, paddingBottom:7, borderBottom:`1px solid ${selClr}14` }}>
              <span style={{ fontSize:11 }}>📍</span>
              <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1, color:`${selClr}aa`, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:175 }}>{locationLabel}</span>
            </div>
          )}
          {([['LAT', `${(sel.latitudeDeg||0).toFixed(3)}°`], ['LON', `${(sel.longitudeDeg||0).toFixed(3)}°`], ['ALT', sel.altitudeKm ? `${sel.altitudeKm.toFixed(0)} km` : '—'], ['VEL', sel.speedKmPerS ? `${sel.speedKmPerS.toFixed(2)} km/s` : '—']] as [string,string][]).map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:20, padding:'3px 0', borderBottom:'1px solid rgba(0,194,255,.05)' }}>
              <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1, color:'rgba(100,140,170,.45)' }}>{k}</span>
              <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, fontWeight:'bold', color:'#CBD9E8' }}>{v}</span>
            </div>
          ))}
          {sel.altitudeKm && (
            <div style={{ marginTop:8 }}>
              <div style={{ height:1.5, background:`${selClr}14`, borderRadius:1 }}>
                <div style={{ height:'100%', width:`${Math.min(100,(sel.altitudeKm/2000)*100)}%`, background:selClr, borderRadius:1, transition:'width 1.2s ease' }} />
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position:'absolute', top:12, right:12, zIndex:460, background:'rgba(11,15,26,.9)', border:'1px solid rgba(0,194,255,.1)', padding:'8px 12px', pointerEvents:'none' }}>
        {[
          { c:'rgba(0,194,255,.5)',   label:'EQUATOR',  dot:false, solid:false },
          { c:'rgba(184,115,51,.45)', label:'TROPICS',  dot:false, solid:false },
          { c:'rgba(0,150,200,.35)',  label:'POLAR',    dot:false, solid:false },
          { c:'rgba(46,139,87,.45)',  label:'OBSERVER', dot:false, solid:true  },
          { c:'#4285f4',              label:'YOU',      dot:true,  solid:false },
        ].map(({ c, label, dot, solid }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            {dot ? <div style={{ width:7, height:7, borderRadius:'50%', background:c, border:'1.5px solid #fff', flexShrink:0 }} /> : <div style={{ width:18, height:0, borderTop: solid ? `1.5px solid ${c}` : `1px dashed ${c}`, flexShrink:0 }} />}
            <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1.5, color:'rgba(0,194,255,.28)' }}>{label}</span>
          </div>
        ))}
        <div style={{ borderTop:'1px solid rgba(0,194,255,.06)', marginTop:5, paddingTop:5 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <div style={{ width:18, height:0, borderTop:'1.5px solid rgba(0,194,255,.7)', flexShrink:0 }} />
            <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1.5, color:'rgba(0,194,255,.28)' }}>PAST ORBIT</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:18, height:0, borderTop:'1px dashed rgba(0,194,255,.4)', flexShrink:0 }} />
            <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1.5, color:'rgba(0,194,255,.28)' }}>FUTURE PATH</span>
          </div>
        </div>
      </div>

      {isTransition && <div style={{ position:'absolute', inset:0, zIndex:500, pointerEvents:'none', background:'rgba(11,15,26,.22)', animation:'__blink 0.4s ease' }} />}

      <style>{`
        @keyframes __blink   { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes __fadeIn  { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes __pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.22)} }
        @keyframes __locPing { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(3.2);opacity:0} }
      `}</style>
    </div>
  );
}
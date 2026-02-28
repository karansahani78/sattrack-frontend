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

/* ─── color palette ─────────────────────────────────────────── */
const COLORS = ['#00d4ff','#ff6b35','#39ff14','#ffd700','#ff69b4','#c084fc','#34d399','#fb923c','#60a5fa','#f472b6'];
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
    <circle cx="${cx}" cy="${cy}" r="${cx-2}" fill="none" stroke="${color}" stroke-width="1" opacity="0.6">
      <animate attributeName="r" from="${cx-10}" to="${cx-1}" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx}" cy="${cy}" r="${cx-4}" fill="none" stroke="${color}" stroke-width="0.7" opacity="0.4">
      <animate attributeName="r" from="${cx-10}" to="${cx-1}" dur="1.8s" begin="0.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.4" to="0" dur="1.8s" begin="0.5s" repeatCount="indefinite"/>
    </circle>` : '';

  const cross = selected ? `
    <line x1="${cx}" y1="2" x2="${cx}" y2="${cy-S/2-2}" stroke="${color}" stroke-width="0.8" opacity="0.7"/>
    <line x1="${cx}" y1="${cy+S/2+2}" x2="${cx}" y2="${H-2}" stroke="${color}" stroke-width="0.8" opacity="0.7"/>
    <line x1="2" y1="${cy}" x2="${cx-S/2-2}" y2="${cy}" stroke="${color}" stroke-width="0.8" opacity="0.7"/>
    <line x1="${cx+S/2+2}" y1="${cy}" x2="${W-2}" y2="${cy}" stroke="${color}" stroke-width="0.8" opacity="0.7"/>` : '';

  const label = selected ? `
    <div style="position:absolute;top:${H+5}px;left:50%;transform:translateX(-50%);
      white-space:nowrap;pointer-events:none;
      font-family:'Orbitron',monospace;font-size:9px;font-weight:600;
      letter-spacing:1.5px;color:${color};
      text-shadow:0 0 10px ${color},0 0 20px ${color}66;
      background:rgba(3,7,18,.9);padding:2px 7px;
      border:1px solid ${color}44;">${name}</div>` : '';

  return L.divIcon({
    html: `<div style="position:relative;width:${W}px;height:${H}px;">
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" overflow="visible">
        <defs>
          <filter id="glow${color.slice(1)}${W}">
            <feGaussianBlur stdDeviation="${selected ? 3.5 : 1.8}" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="dot${color.slice(1)}${W}">
            <stop offset="0%" stop-color="#fff" stop-opacity="0.9"/>
            <stop offset="40%" stop-color="${color}" stop-opacity="1"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.7"/>
          </radialGradient>
        </defs>
        ${rings}${cross}
        <circle cx="${cx}" cy="${cy}" r="${S/2+(selected?5:3)}"
          fill="${color}" opacity="${selected?0.25:0.18}"
          filter="url(#glow${color.slice(1)}${W})"/>
        <circle cx="${cx}" cy="${cy}" r="${S/2}"
          fill="url(#dot${color.slice(1)}${W})"
          stroke="rgba(255,255,255,${selected?0.95:0.75})"
          stroke-width="${selected?2:1.3}"
          filter="url(#glow${color.slice(1)}${W})"/>
        ${!selected ? `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#fff" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2.5s" repeatCount="indefinite"/>
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
          <radialGradient id="obsG"><stop offset="0%" stop-color="#00ff88" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#00ff88" stop-opacity="0"/></radialGradient>
        </defs>
        <circle cx="18" cy="18" r="17" fill="url(#obsG)"/>
        <circle cx="18" cy="18" r="16" fill="none" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
        <circle cx="18" cy="18" r="10" fill="none" stroke="#00ff88" stroke-width="0.6" opacity="0.35"/>
        <circle cx="18" cy="18" r="5"  fill="none" stroke="#00ff88" stroke-width="0.6" opacity="0.45"/>
        <line x1="18" y1="2"  x2="18" y2="6"  stroke="#00ff88" stroke-width="1.2" opacity="0.8"/>
        <line x1="18" y1="30" x2="18" y2="34" stroke="#00ff88" stroke-width="1.2" opacity="0.8"/>
        <line x1="2"  y1="18" x2="6"  y2="18" stroke="#00ff88" stroke-width="1.2" opacity="0.8"/>
        <line x1="30" y1="18" x2="34" y2="18" stroke="#00ff88" stroke-width="1.2" opacity="0.8"/>
        <line x1="18" y1="18" x2="18" y2="3" stroke="#00ff88" stroke-width="1.8" opacity="0.95" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="3.5s" repeatCount="indefinite"/>
        </line>
        <circle cx="18" cy="18" r="4" fill="#00ff88" stroke="#fff" stroke-width="1.5"
          style="filter:drop-shadow(0 0 8px #00ff88)"/>
        <circle cx="18" cy="18" r="4" fill="#00ff88" opacity="0.5">
          <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
        </circle>
      </svg></div>`,
    className: '',
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
  });
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
    .leaflet-container { background:#020a18!important;font-family:'Share Tech Mono',monospace!important; }
    .leaflet-tile-pane,.leaflet-tile { background:#020a18; }

    .leaflet-control-zoom {
      border:1px solid rgba(0,200,255,.2)!important;
      box-shadow:0 0 20px rgba(0,0,0,.8)!important;border-radius:2px!important;
    }
    .leaflet-control-zoom a {
      background:rgba(3,7,24,.95)!important;color:#00c8ff!important;
      border:none!important;border-bottom:1px solid rgba(0,200,255,.1)!important;
      font-family:'Orbitron',monospace!important;font-weight:700!important;font-size:16px!important;
      width:32px!important;height:32px!important;line-height:32px!important;
      display:flex!important;align-items:center!important;justify-content:center!important;
      transition:all .2s!important;border-radius:0!important;
    }
    .leaflet-control-zoom a:hover {
      background:rgba(0,200,255,.16)!important;color:#fff!important;
      box-shadow:inset 0 0 14px rgba(0,200,255,.25)!important;
    }
    .leaflet-bar { border:none!important;border-radius:2px!important;overflow:hidden; }
    .leaflet-control-attribution {
      background:rgba(3,7,24,.85)!important;color:rgba(0,200,255,.3)!important;
      font-family:'Share Tech Mono',monospace!important;font-size:9px!important;
      letter-spacing:.5px;padding:3px 8px!important;
    }
    .leaflet-control-attribution a { color:rgba(0,200,255,.5)!important; }
    .leaflet-tooltip {
      background:rgba(3,8,28,.97)!important;border:1px solid rgba(0,200,255,.3)!important;
      border-radius:1px!important;color:#00d4ff!important;
      font-family:'Share Tech Mono',monospace!important;font-size:11px!important;
      letter-spacing:1.5px!important;box-shadow:0 0 20px rgba(0,200,255,.2)!important;
      padding:6px 12px!important;backdrop-filter:blur(14px)!important;white-space:nowrap;
    }
    .leaflet-tooltip::before { display:none!important; }
    .leaflet-tooltip-top { margin-top:-10px!important; }
    .leaflet-popup-content-wrapper {
      background:rgba(3,8,28,.97)!important;border:1px solid rgba(0,200,255,.2)!important;
      border-radius:2px!important;color:#e2f0ff!important;font-family:'Share Tech Mono',monospace!important;
    }
    .leaflet-popup-tip { background:rgba(3,8,28,.97)!important; }
    .leaflet-popup-close-button { color:#00c8ff!important; }

    @keyframes __blink   { 0%,100%{opacity:1} 50%{opacity:.15} }
    @keyframes __fadeIn  { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
    @keyframes __pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }
    @keyframes __locPing { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(3);opacity:0} }
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
  // FIX: widened type to include Marker — arrowhead direction markers pushed
  // into this ref are L.Marker, not Polyline/CircleMarker (fixes TS2345).
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
    const gr = { color: 'rgba(0,180,255,.07)', weight: 0.5, interactive: false as const };
    for (let lt = -60; lt <= 60; lt += 30) L.polyline([[lt,-180],[lt,180]], gr).addTo(map);
    for (let ln = -150; ln <= 150; ln += 30) L.polyline([[-90,ln],[90,ln]], gr).addTo(map);
    L.polyline([[0,-180],[0,180]], { color:'rgba(0,212,255,.22)', weight:1, dashArray:'6 12', interactive:false }).addTo(map);
    L.polyline([[-90,0],[90,0]], { color:'rgba(0,212,255,.15)', weight:1, dashArray:'6 12', interactive:false }).addTo(map);
    [23.5,-23.5].forEach(lt => L.polyline([[lt,-180],[lt,180]], { color:'rgba(255,120,50,.1)', weight:0.6, dashArray:'3 8', interactive:false }).addTo(map));
    [66.5,-66.5].forEach(lt => L.polyline([[lt,-180],[lt,180]], { color:'rgba(100,180,255,.08)', weight:0.5, dashArray:'2 6', interactive:false }).addTo(map));

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
           <div style="font-size:9px;color:rgba(140,200,255,.85);letter-spacing:1px;">${userLocLabel}</div>
           <div style="font-size:8px;color:rgba(100,150,200,.5);margin-top:2px;">±${Math.round(userPos.acc)}m accuracy</div>`
        );
      userAccRef.current?.setLatLng([userPos.lat, userPos.lon]);
      return;
    }

    userAccRef.current = L.marker([userPos.lat, userPos.lon], {
      icon: L.divIcon({
        html: `<div style="width:50px;height:50px;border-radius:50%;background:rgba(66,133,244,0.12);border:1.5px solid rgba(66,133,244,0.35);box-shadow:0 0 16px rgba(66,133,244,0.2);"></div>`,
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
          <div style="position:absolute;inset:-5px;border-radius:50%;background:rgba(66,133,244,0.22);animation:__locPing 2.2s ease-out infinite;"></div>
          <div style="position:absolute;inset:0;border-radius:50%;background:#4285f4;border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.55),0 0 0 2px rgba(66,133,244,0.25);"></div>
          <div style="position:absolute;top:3px;left:4px;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.65);"></div>
        </div>`,
        className: '',
        iconSize:   [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 1500,
    })
      .bindTooltip(
        `<div style="font-family:'Orbitron',monospace;font-size:10px;color:#4285f4;letter-spacing:2px;margin-bottom:3px;">YOUR LOCATION</div>
         <div style="font-size:9px;color:rgba(140,200,255,.85);letter-spacing:1px;">${userLocLabel}</div>
         <div style="font-size:8px;color:rgba(100,150,200,.5);margin-top:2px;">±${Math.round(userPos.acc)}m accuracy</div>`,
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
        (alt ? `<div style="font-size:9px;color:rgba(140,180,210,.7);letter-spacing:1px;">ALT ${alt}${vel?' · '+vel:''}</div>` : '');
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

    const color  = getSatColor(selectedNoradId);
    const nPts   = trackPoints.length;
    const splitIdx = Math.floor(nPts * 0.5);

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

    splitAtAntimeridian(pastPts).forEach(seg => {
      if (seg.length < 2) return;
      trackRef.current.push(L.polyline(seg, { color, weight: 7, opacity: 0.18, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(map));
    });
    splitAtAntimeridian(pastPts).forEach(seg => {
      if (seg.length < 2) return;
      trackRef.current.push(L.polyline(seg, { color, weight: 2.5, opacity: 0.95, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(map));
    });
    pastPts.forEach((pt, i) => {
      if (i % 8 !== 0) return;
      const ageFraction = i / pastPts.length;
      const opacity = 0.25 + ageFraction * 0.55;
      const radius  = 1.5 + ageFraction * 1.5;
      trackRef.current.push(L.circleMarker([pt.latitudeDeg, pt.longitudeDeg], { radius, color, fillColor: color, fillOpacity: opacity, weight: 0, opacity, interactive: false }).addTo(map));
    });

    splitAtAntimeridian(futurePts).forEach(seg => {
      if (seg.length < 2) return;
      trackRef.current.push(L.polyline(seg, { color, weight: 5, opacity: 0.08, interactive: false, lineCap: 'round' }).addTo(map));
    });
    splitAtAntimeridian(futurePts).forEach(seg => {
      if (seg.length < 2) return;
      trackRef.current.push(L.polyline(seg, { color, weight: 1.8, opacity: 0.65, dashArray: '5 9', interactive: false, lineCap: 'round' }).addTo(map));
    });
    futurePts.forEach((pt, i) => {
      if (i === 0 || i % 12 !== 0 || i >= futurePts.length - 1) return;
      const prev = futurePts[i - 1];
      if (Math.abs(pt.longitudeDeg - prev.longitudeDeg) > 180) return;
      const angle = Math.atan2(pt.longitudeDeg - prev.longitudeDeg, pt.latitudeDeg - prev.latitudeDeg) * (180 / Math.PI);
      trackRef.current.push(
        L.marker([pt.latitudeDeg, pt.longitudeDeg], {
          icon: L.divIcon({
            html: `<div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:9px solid ${color};opacity:0.75;transform:rotate(${angle}deg);transform-origin:center center;filter:drop-shadow(0 0 3px ${color});"></div>`,
            className: '', iconSize: [8, 9], iconAnchor: [4, 4],
          }),
          interactive: false, zIndexOffset: -100,
        }).addTo(map)
      );
    });

    trackRef.current.push(L.circleMarker([trackPoints[0].latitudeDeg, trackPoints[0].longitudeDeg], { radius: 4, color, fillColor: 'transparent', fillOpacity: 0, weight: 1.5, opacity: 0.5, interactive: false }).addTo(map));
    trackRef.current.push(L.circleMarker([trackPoints[nPts-1].latitudeDeg, trackPoints[nPts-1].longitudeDeg], { radius: 5, color, fillColor: color, fillOpacity: 0.15, weight: 1.5, opacity: 0.6, interactive: false }).addTo(map));
    trackRef.current.push(L.circleMarker([trackPoints[splitIdx].latitudeDeg, trackPoints[splitIdx].longitudeDeg], { radius: 7, color, fillColor: color, fillOpacity: 0.12, weight: 1.5, opacity: 0.7, interactive: false }).addTo(map));

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
      `<div style="font-family:'Orbitron',monospace;font-size:10px;color:#00ff88;letter-spacing:3px;">OBSERVER</div>
       <div style="font-size:9px;color:rgba(0,255,136,.65);letter-spacing:1px;margin-top:2px;">
         ${observerLocation.lat.toFixed(3)}° · ${observerLocation.lon.toFixed(3)}°</div>`,
      { direction: 'top', offset: [0, -18] }
    ).addTo(map);

    horizonRef.current = L.circle(
      [observerLocation.lat, observerLocation.lon],
      { radius:1_800_000, color:'rgba(0,255,136,.3)', fillColor:'rgba(0,255,136,.04)', weight:1.2, dashArray:'6 10', interactive:false }
    ).addTo(map);

    L.circle(
      [observerLocation.lat, observerLocation.lon],
      { radius:500_000, color:'rgba(0,255,136,.12)', fillColor:'transparent', weight:0.6, dashArray:'3 6', interactive:false }
    ).addTo(map);

    return () => { observerMarkerRef.current?.remove(); horizonRef.current?.remove(); };
  }, [observerLocation]);

  /* ── 8. Reverse-geocode selected satellite ───────────────── */
  // FIX: Nominatim returns {"error":"Unable to geocode"} for open ocean coords.
  // Explicitly check data.error, keep prev label on network failure.
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
  const selClr = selectedNoradId ? getSatColor(selectedNoradId) : '#00d4ff';

  const zoomLabel = zoomLevel <= 2 ? 'GLOBAL' : zoomLevel <= 4 ? 'CONTINENT'
    : zoomLevel <= 6 ? 'COUNTRY' : zoomLevel <= 9 ? 'REGION'
    : zoomLevel <= 11 ? 'CITY' : zoomLevel <= 14 ? 'DISTRICT' : 'STREET';

  const viewBtns: { mode: ViewMode; label: string; icon: string; color: string; desc: string }[] = [
    { mode: 'normal',    label: 'DARK',    icon: '◈', color: '#00c8ff', desc: 'Dark vector' },
    { mode: 'satellite', label: 'SAT',     icon: '⊛', color: '#34d399', desc: 'Aerial imagery' },
    { mode: 'terrain',   label: 'TERRAIN', icon: '⬡', color: '#fbbf24', desc: 'Topographic' },
  ];

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', borderRadius:'inherit', overflow:'hidden', background:'#020a18' }}>

      <div ref={containerRef} style={{ width:'100%', height:'100%', background:'#020a18', opacity: isTransition ? 0.6 : 1, transition:'opacity 0.4s ease' }} />

      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:400, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,200,255,.012) 2px,rgba(0,200,255,.012) 4px)', opacity: viewMode === 'satellite' ? 0.35 : 1 }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:401, background:'radial-gradient(ellipse at center,transparent 50%,rgba(2,10,24,.68) 100%)' }} />

      {[
        { top:8,    left:8,   borderTop:'2px solid rgba(0,200,255,.5)',    borderLeft:'2px solid rgba(0,200,255,.5)' },
        { top:8,    right:8,  borderTop:'2px solid rgba(0,200,255,.5)',    borderRight:'2px solid rgba(0,200,255,.5)' },
        { bottom:8, left:8,   borderBottom:'2px solid rgba(0,200,255,.5)', borderLeft:'2px solid rgba(0,200,255,.5)' },
        { bottom:8, right:8,  borderBottom:'2px solid rgba(0,200,255,.5)', borderRight:'2px solid rgba(0,200,255,.5)' },
      ].map((s,i) => <div key={i} style={{ position:'absolute', width:18, height:18, pointerEvents:'none', zIndex:460, ...s }} />)}

      <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', zIndex:460, display:'flex', alignItems:'center', gap:8, background:'rgba(3,7,24,.92)', border:'1px solid rgba(0,200,255,.22)', padding:'5px 18px', backdropFilter:'blur(14px)', pointerEvents:'none' }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:'#00ff88', boxShadow:'0 0 10px #00ff88', display:'inline-block', animation:'__blink 1.5s infinite' }} />
        <span style={{ fontFamily:"'Orbitron',monospace", fontSize:9, letterSpacing:4, color:'rgba(0,200,255,.85)' }}>LIVE ORBITAL DISPLAY</span>
      </div>

      <div style={{ position:'absolute', top:12, left:12, zIndex:460, animation:'__fadeIn 0.4s ease' }}>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:2, color:'rgba(0,200,255,.35)', marginBottom:4, paddingLeft:2 }}>MAP VIEW</div>
        <div style={{ display:'flex', gap:3 }}>
          {viewBtns.map(({ mode, label, icon, color, desc }) => {
            const active = viewMode === mode;
            return (
              <button key={mode} title={desc} onClick={() => setViewMode(mode)} style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, width:56, height:52, cursor:'pointer', position:'relative', background: active ? `linear-gradient(145deg,${color}22,${color}0c)` : 'rgba(3,7,24,.92)', border: `1px solid ${active ? color : 'rgba(0,200,255,.15)'}`, borderRadius:2, color: active ? color : 'rgba(0,200,255,.4)', backdropFilter:'blur(14px)', boxShadow: active ? `0 0 18px ${color}44,inset 0 0 10px ${color}10` : '0 2px 8px rgba(0,0,0,.5)', transition:'all 0.22s ease', padding:0 }}>
                <span style={{ fontSize:14, lineHeight:1, opacity:active?1:0.55 }}>{icon}</span>
                <span style={{ fontFamily:"'Orbitron',monospace", fontSize:7, letterSpacing:1, fontWeight:700, lineHeight:1, opacity:active?1:0.45 }}>{label}</span>
                {active && <span style={{ position:'absolute', bottom:2, width:24, height:1.5, background:color, borderRadius:1, boxShadow:`0 0 6px ${color}` }} />}
              </button>
            );
          })}
        </div>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1, color: viewBtns.find(b=>b.mode===viewMode)?.color, opacity:0.5, paddingLeft:2, marginTop:5, transition:'color 0.3s' }}>{viewBtns.find(b=>b.mode===viewMode)?.desc}</div>
      </div>

      <div style={{ position:'absolute', top:138, left:12, zIndex:460, background:'rgba(3,7,24,.92)', border:'1px solid rgba(66,133,244,.22)', borderLeft:'3px solid #4285f4', backdropFilter:'blur(14px)', minWidth:178, animation:'__fadeIn 0.5s ease 0.15s both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px 6px', borderBottom:'1px solid rgba(66,133,244,.12)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#4285f4', boxShadow:'0 0 8px #4285f4', animation: locStatus==='locating' ? '__pulse 0.9s infinite' : 'none' }} />
            <span style={{ fontFamily:"'Orbitron',monospace", fontSize:8, letterSpacing:2, color:'#4285f4' }}>MY LOCATION</span>
          </div>
          <button onClick={flyToMe} title="Fly to my location on map" style={{ background:'rgba(66,133,244,.15)', border:'1px solid rgba(66,133,244,.3)', borderRadius:2, color:'#4285f4', cursor:'pointer', padding:'2px 8px', fontFamily:"'Orbitron',monospace", fontSize:8, letterSpacing:1, transition:'all 0.2s', display:'flex', alignItems:'center', gap:3 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(66,133,244,.28)')} onMouseLeave={e => (e.currentTarget.style.background = 'rgba(66,133,244,.15)')}>⊕ GOTO</button>
        </div>
        <div style={{ padding:'8px 10px' }}>
          {locStatus === 'idle' && <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'rgba(100,150,200,.5)', letterSpacing:0.5 }}>Waiting for GPS…</div>}
          {locStatus === 'locating' && <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'rgba(66,133,244,.65)', display:'flex', alignItems:'center', gap:6 }}><span style={{ animation:'__blink 0.9s infinite' }}>◉</span> Acquiring GPS signal…</div>}
          {locStatus === 'error' && <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'rgba(255,100,100,.75)', letterSpacing:0.5, lineHeight:1.5 }}>⚠ {userLocLabel}</div>}
          {locStatus === 'found' && userPos && (
            <>
              {userLocLabel && <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9.5, letterSpacing:0.5, color:'rgba(190,220,255,.9)', marginBottom:7, lineHeight:1.55 }}>{userLocLabel}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 10px', marginBottom:5 }}>
                {[['LAT', `${userPos.lat.toFixed(5)}°`], ['LON', `${userPos.lon.toFixed(5)}°`]].map(([k,v]) => (
                  <div key={k}>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:7, letterSpacing:1, color:'rgba(66,133,244,.5)', marginBottom:1 }}>{k}</div>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'#e2f0ff', letterSpacing:0.5 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                <div style={{ flex:1, height:2, background:'rgba(66,133,244,.15)', borderRadius:1 }}>
                  <div style={{ height:'100%', borderRadius:1, background:'#4285f4', width:`${Math.max(5, Math.min(100, 100 - Math.log10(Math.max(userPos.acc,1)) * 30))}%`, transition:'width 1s ease', boxShadow:'0 0 6px #4285f4' }} />
                </div>
                <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:'rgba(66,133,244,.5)', letterSpacing:0.5, whiteSpace:'nowrap' }}>±{Math.round(userPos.acc)}m</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ position:'absolute', bottom:82, right:11, zIndex:460, background:'rgba(3,7,24,.9)', border:'1px solid rgba(0,200,255,.12)', padding:'5px 10px', backdropFilter:'blur(10px)', pointerEvents:'none', display:'flex', flexDirection:'column', alignItems:'center', minWidth:52 }}>
        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:7, letterSpacing:1.5, color:'rgba(0,200,255,.35)', marginBottom:1 }}>ZOOM</span>
        <span style={{ fontFamily:"'Orbitron',monospace", fontSize:14, fontWeight:700, color:'rgba(0,200,255,.8)', lineHeight:1 }}>{zoomLevel}</span>
        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:7, color:'rgba(0,200,255,.3)', letterSpacing:0.5, marginTop:2 }}>{zoomLabel}</span>
      </div>

      <div style={{ position:'absolute', bottom:36, left:12, zIndex:460, background:'rgba(3,7,24,.9)', border:'1px solid rgba(0,200,255,.15)', padding:'5px 12px', backdropFilter:'blur(10px)', pointerEvents:'none' }}>
        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:2, color:'rgba(0,200,255,.6)' }}>
          {count} <span style={{ color:'rgba(0,200,255,.3)' }}>OBJECTS TRACKED</span>
        </span>
      </div>

      {sel && selectedNoradId && (
        <div style={{ position:'absolute', bottom:36, right:48, zIndex:460, background:'rgba(3,7,24,.94)', border:`1px solid ${selClr}28`, borderLeft:`3px solid ${selClr}`, padding:'10px 14px', backdropFilter:'blur(14px)', pointerEvents:'none', minWidth:225, boxShadow:`0 0 30px ${selClr}18`, animation:'__fadeIn 0.3s ease' }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:10, fontWeight:600, letterSpacing:2, color:selClr, textShadow:`0 0 12px ${selClr}`, marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sel.name || `NORAD ${selectedNoradId}`}</div>
          {locationLabel && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, paddingBottom:7, borderBottom:`1px solid ${selClr}18` }}>
              <span style={{ fontSize:11 }}>📍</span>
              <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1, color:`${selClr}cc`, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:175 }}>{locationLabel}</span>
            </div>
          )}
          {([['LAT', `${(sel.latitudeDeg||0).toFixed(3)}°`], ['LON', `${(sel.longitudeDeg||0).toFixed(3)}°`], ['ALT', sel.altitudeKm ? `${sel.altitudeKm.toFixed(0)} km` : '—'], ['VEL', sel.speedKmPerS ? `${sel.speedKmPerS.toFixed(2)} km/s` : '—']] as [string,string][]).map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:20, padding:'3px 0', borderBottom:'1px solid rgba(0,200,255,.06)' }}>
              <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1, color:'rgba(140,180,210,.5)' }}>{k}</span>
              <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, fontWeight:'bold', color:'#e2f0ff' }}>{v}</span>
            </div>
          ))}
          {sel.altitudeKm && (
            <div style={{ marginTop:8 }}>
              <div style={{ height:2, background:`${selClr}18`, borderRadius:1 }}>
                <div style={{ height:'100%', width:`${Math.min(100,(sel.altitudeKm/2000)*100)}%`, background:`linear-gradient(90deg,${selClr},${selClr}88)`, boxShadow:`0 0 8px ${selClr}`, borderRadius:1, transition:'width 1.2s ease' }} />
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position:'absolute', top:12, right:12, zIndex:460, background:'rgba(3,7,24,.87)', border:'1px solid rgba(0,200,255,.1)', padding:'8px 12px', backdropFilter:'blur(10px)', pointerEvents:'none' }}>
        {[
          { c:'rgba(0,212,255,.6)',   label:'EQUATOR',  dot:false, solid:false },
          { c:'rgba(255,120,50,.5)',  label:'TROPICS',  dot:false, solid:false },
          { c:'rgba(100,180,255,.4)', label:'POLAR',    dot:false, solid:false },
          { c:'rgba(0,255,136,.5)',   label:'OBSERVER', dot:false, solid:true  },
          { c:'#4285f4',              label:'YOU',      dot:true,  solid:false },
        ].map(({ c, label, dot, solid }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            {dot ? <div style={{ width:8, height:8, borderRadius:'50%', background:c, border:'1.5px solid #fff', flexShrink:0 }} /> : <div style={{ width:18, height:0, borderTop: solid ? `2px solid ${c}` : `1.5px dashed ${c}`, flexShrink:0 }} />}
            <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1.5, color:'rgba(0,200,255,.35)' }}>{label}</span>
          </div>
        ))}
        <div style={{ borderTop:'1px solid rgba(0,200,255,.08)', marginTop:5, paddingTop:5 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <div style={{ width:18, height:0, borderTop:'2px solid rgba(0,212,255,.8)', flexShrink:0 }} />
            <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1.5, color:'rgba(0,200,255,.35)' }}>PAST ORBIT</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:18, height:0, borderTop:'1.5px dashed rgba(0,212,255,.5)', flexShrink:0 }} />
            <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1.5, color:'rgba(0,200,255,.35)' }}>FUTURE PATH</span>
          </div>
        </div>
      </div>

      {isTransition && <div style={{ position:'absolute', inset:0, zIndex:500, pointerEvents:'none', background:'rgba(2,10,24,.28)', animation:'__blink 0.4s ease' }} />}

      <style>{`
        @keyframes __blink   { 0%,100%{opacity:1} 50%{opacity:.15} }
        @keyframes __fadeIn  { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes __pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.22)} }
        @keyframes __locPing { 0%{transform:scale(1);opacity:0.65} 100%{transform:scale(3.2);opacity:0} }
      `}</style>
    </div>
  );
}
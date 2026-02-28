import { useState, useEffect } from 'react';
import { MapPin, Crosshair, Maximize2, Minimize2 } from 'lucide-react';
import { WorldMap } from '../components/WorldMap';
import { SatelliteInfoPanel } from '../components/SatelliteInfoPanel';
import { useLivePosition, useOrbitalTrack, useGeolocation, useUtcClock } from '../hooks';
import { useStore } from '../stores/useStore';
import { satelliteApi } from '../services/api';
import type { SatelliteSummary } from '../types';
import { addHours, subHours, formatISO } from 'date-fns';

export function Dashboard() {
  const {
    selectedNoradId, setSelectedSatellite,
    trackedIds, positions, updatePosition,
    observerLocation, setObserverLocation
  } = useStore();

  const [satellite, setSatellite] = useState<SatelliteSummary | null>(null);
  const [showTrack, setShowTrack] = useState(true);
  const [trackHours, setTrackHours] = useState(1.5);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SatelliteSummary[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);

  const now = useUtcClock();
  const { locate, status: geoStatus } = useGeolocation();

  // ── All original API/hook logic untouched ────────────────────────────────
  const { position, loading, refresh } = useLivePosition(selectedNoradId);

  const trackStart = formatISO(subHours(now, trackHours / 2));
  const trackEnd   = formatISO(addHours(now, trackHours / 2));
  const { track }  = useOrbitalTrack(
    showTrack ? selectedNoradId : null,
    trackStart, trackEnd, 30
  );

  useEffect(() => {
    if (!selectedNoradId) return;
    satelliteApi.get(selectedNoradId)
      .then(setSatellite)
      .catch(() => setSatellite(null));
  }, [selectedNoradId]);

  useEffect(() => {
    if (!searchInput.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await satelliteApi.search(searchInput, 0, 8).catch(() => null);
      setSearchResults(res?.content || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const allPositions = { ...positions };
  if (position && selectedNoradId) allPositions[selectedNoradId] = position;

  const POPULAR = [
    { noradId: '25544', name: 'ISS' },
    { noradId: '20580', name: 'Hubble' },
    { noradId: '43226', name: 'CSS (Tianhe)' },
    { noradId: '33591', name: 'NOAA 19' },
  ];

  // Lock body scroll in fullscreen
  useEffect(() => {
    document.body.style.overflow = mapFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mapFullscreen]);

  // ESC exits fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMapFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Shared toolbar (rendered in both normal + fullscreen) ────────────────
  const toolbar = (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-space-900/50 flex-wrap"
      style={{ flexShrink: 0 }}>

      {/* Satellite search */}
      <div className="relative flex-1 min-w-48 max-w-sm">
        <input
          type="text"
          value={searchInput}
          onChange={e => { setSearchInput(e.target.value); setShowSearch(true); }}
          onBlur={() => setTimeout(() => setShowSearch(false), 200)}
          placeholder="Search satellites..."
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-satellite-cyan"
        />
        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-space-800 border border-white/20 rounded-lg shadow-xl z-[10002] overflow-hidden">
            {searchResults.map(s => (
              <button
                key={s.noradId}
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center justify-between"
                onMouseDown={() => {
                  setSelectedSatellite(s.noradId);
                  setSearchInput('');
                  setShowSearch(false);
                }}
              >
                <span className="text-white">{s.name}</span>
                <span className="text-gray-500 text-xs font-mono">{s.noradId}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick select */}
      <div className="flex gap-1">
        {POPULAR.map(s => (
          <button
            key={s.noradId}
            onClick={() => setSelectedSatellite(s.noradId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedNoradId === s.noradId
                ? 'bg-satellite-blue text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Observer location */}
        <button
          onClick={locate}
          disabled={geoStatus === 'loading'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
            observerLocation
              ? 'bg-satellite-green/20 text-satellite-green border border-satellite-green/30'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
          title="Set observer location to your position"
        >
          {geoStatus === 'loading'
            ? <Crosshair className="w-3.5 h-3.5 animate-spin" />
            : <MapPin className="w-3.5 h-3.5" />
          }
          {observerLocation ? 'Located' : 'My Location'}
        </button>

        {/* Track toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showTrack}
            onChange={e => setShowTrack(e.target.checked)}
            className="w-4 h-4 rounded accent-satellite-cyan"
          />
          <span className="text-xs text-gray-400">Show orbit</span>
        </label>

        {showTrack && (
          <select
            value={trackHours}
            onChange={e => setTrackHours(Number(e.target.value))}
            className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
          >
            <option value={0.5}>±30 min</option>
            <option value={1.5}>±90 min</option>
            <option value={3}>±3 hr</option>
            <option value={6}>±6 hr</option>
          </select>
        )}

        {/* Fullscreen toggle button */}
        <button
          onClick={() => setMapFullscreen(f => !f)}
          title={mapFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen map'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
        >
          {mapFullscreen
            ? <><Minimize2 className="w-3.5 h-3.5" /> Exit</>
            : <><Maximize2 className="w-3.5 h-3.5" /> Fullscreen</>
          }
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // FULLSCREEN MODE
  // ══════════════════════════════════════════════════════════════════════════
  if (mapFullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#020a18', display: 'flex', flexDirection: 'column',
      }}>
        {/* Toolbar sits above the map at zIndex 10001 */}
        <div style={{ position: 'relative', zIndex: 10001 }}>
          {toolbar}
        </div>

        {/* Satellite name + live stats bar */}
        {satellite && (
          <div style={{
            position: 'relative', zIndex: 10001,
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '6px 16px',
            background: 'rgba(2,6,20,.97)',
            borderBottom: '1px solid rgba(0,200,255,.1)',
            flexShrink: 0,
          }}>
            {/* Pulsing dot */}
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: '#00ff88', boxShadow: '0 0 8px #00ff88',
              animation: 'db-blink 1.5s infinite',
            }} />
            <span style={{
              fontFamily: "'Orbitron',monospace", fontSize: 12, fontWeight: 700,
              letterSpacing: 3, color: '#00d4ff', textShadow: '0 0 12px rgba(0,200,255,.4)',
            }}>
              {satellite.name}
            </span>
            {position && (
              <span style={{
                fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
                color: 'rgba(140,180,210,.6)', letterSpacing: 1,
              }}>
                {position.latitudeDeg.toFixed(3)}° / {position.longitudeDeg.toFixed(3)}°
                &nbsp;·&nbsp;{position.altitudeKm.toFixed(0)} km
                &nbsp;·&nbsp;{(position.speedKmPerS ?? 0).toFixed(2)} km/s
              </span>
            )}
            <span style={{
              marginLeft: 'auto',
              fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
              color: 'rgba(0,200,255,.3)', letterSpacing: 1,
              border: '1px solid rgba(0,200,255,.1)', padding: '2px 7px',
            }}>
              ESC to exit
            </span>
          </div>
        )}

        {/* Map fills all remaining space */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 10000 }}>
          <WorldMap
            positions={allPositions}
            trackPoints={track?.points}
            selectedNoradId={selectedNoradId}
            onSatelliteClick={setSelectedSatellite}
          />
        </div>

        <style>{`
          @keyframes db-blink { 0%,100%{opacity:1} 50%{opacity:.2} }
        `}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NORMAL LAYOUT (identical to original)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {toolbar}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 p-3">
          <div className="h-full relative">
            <WorldMap
              positions={allPositions}
              trackPoints={track?.points}
              selectedNoradId={selectedNoradId}
              onSatelliteClick={setSelectedSatellite}
            />

            {/* Fullscreen button overlaid on map — zIndex 600 clears WorldMap internals */}
            <button
              onClick={() => setMapFullscreen(true)}
              title="Fullscreen map"
              style={{
                position: 'absolute', bottom: 48, right: 10,
                zIndex: 600,
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 11px',
                background: 'rgba(2,6,20,.93)',
                border: '1px solid rgba(0,200,255,.4)',
                color: '#00d4ff', cursor: 'pointer',
                fontFamily: "'Orbitron',monospace", fontSize: 8, letterSpacing: 2,
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 14px rgba(0,200,255,.18)',
                transition: 'all .18s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,200,255,.18)';
                e.currentTarget.style.boxShadow = '0 0 22px rgba(0,200,255,.45)';
                e.currentTarget.style.borderColor = '#00d4ff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(2,6,20,.93)';
                e.currentTarget.style.boxShadow = '0 0 14px rgba(0,200,255,.18)';
                e.currentTarget.style.borderColor = 'rgba(0,200,255,.4)';
              }}
            >
              <Maximize2 style={{ width: 12, height: 12 }} />
              FULLSCREEN
            </button>
          </div>
        </div>

        {/* Sidebar — untouched */}
        <div className="w-72 flex-shrink-0 p-3 pl-0 flex flex-col gap-3 overflow-y-auto">
          <SatelliteInfoPanel
            satellite={satellite || undefined}
            position={position}
            loading={loading}
            onRefresh={refresh}
          />

          <div className="glass-card p-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Tracked Satellites
            </h3>
            <div className="space-y-1">
              {POPULAR.map(s => (
                <button
                  key={s.noradId}
                  onClick={() => setSelectedSatellite(s.noradId)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedNoradId === s.noradId
                      ? 'bg-satellite-blue/20 text-satellite-blue'
                      : 'hover:bg-white/5 text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      positions[s.noradId] ? 'bg-satellite-green animate-pulse' : 'bg-gray-600'
                    }`} />
                    <span>{s.name}</span>
                  </div>
                  <span className="text-xs font-mono text-gray-500">{s.noradId}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
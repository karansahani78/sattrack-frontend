import { useState, useEffect } from 'react';
import { MapPin, ChevronDown, Crosshair, Settings2 } from 'lucide-react';
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

  const now = useUtcClock();
  const { locate, status: geoStatus } = useGeolocation();

  // Live position for selected satellite
  const { position, loading, refresh } = useLivePosition(selectedNoradId);

  // Orbital track
  const trackStart = formatISO(subHours(now, trackHours / 2));
  const trackEnd = formatISO(addHours(now, trackHours / 2));
  const { track } = useOrbitalTrack(
    showTrack ? selectedNoradId : null,
    trackStart, trackEnd, 30
  );

  // Load satellite metadata
  useEffect(() => {
    if (!selectedNoradId) return;
    satelliteApi.get(selectedNoradId)
      .then(setSatellite)
      .catch(() => setSatellite(null));
  }, [selectedNoradId]);

  // Search
  useEffect(() => {
    if (!searchInput.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await satelliteApi.search(searchInput, 0, 8).catch(() => null);
      setSearchResults(res?.content || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build positions map for all tracked satellites
  const allPositions = { ...positions };
  if (position && selectedNoradId) {
    allPositions[selectedNoradId] = position;
  }

  const POPULAR = [
    { noradId: '25544', name: 'ISS' },
    { noradId: '20580', name: 'Hubble' },
    { noradId: '43226', name: 'CSS (Tianhe)' },
    { noradId: '33591', name: 'NOAA 19' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-space-900/50 flex-wrap">
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
            <div className="absolute top-full mt-1 left-0 right-0 bg-space-800 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden">
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
            {geoStatus === 'loading' ? (
              <Crosshair className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MapPin className="w-3.5 h-3.5" />
            )}
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
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 p-3">
          <div className="h-full">
            <WorldMap
              positions={allPositions}
              trackPoints={track?.points}
              selectedNoradId={selectedNoradId}
              onSatelliteClick={setSelectedSatellite}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 p-3 pl-0 flex flex-col gap-3 overflow-y-auto">
          <SatelliteInfoPanel
            satellite={satellite || undefined}
            position={position}
            loading={loading}
            onRefresh={refresh}
          />

          {/* Tracked satellites list */}
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

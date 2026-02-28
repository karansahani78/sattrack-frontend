import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, Radio, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WorldMap } from '../components/WorldMap';
import { SatelliteInfoPanel } from '../components/SatelliteInfoPanel';
import { useLivePosition, useOrbitalTrack, useSatellitePasses, useDoppler, useSatelliteConjunctions } from '../hooks';
import { satelliteApi } from '../services/api';
import type { SatelliteSummary, TleInfo } from '../types';
import { format, addHours, subHours, formatISO } from 'date-fns';
import { useStore } from '../stores/useStore';

type Tab = 'track' | 'predict' | 'tle' | 'passes' | 'doppler';

const C = {
  cyan:   '#00d4ff',
  green:  '#39ff14',
  orange: '#ff7e35',
  yellow: '#ffd060',
  red:    '#ff3344',
  muted:  'rgba(140,180,210,.55)',
  border: 'rgba(0,200,255,.12)',
  surface:'rgba(5,12,35,.95)',
};

const RISK_COLOR: Record<string, string> = {
  LOW: C.green, MEDIUM: C.yellow, HIGH: C.orange, CRITICAL: C.red,
};

export function SatelliteDetail() {
  const { noradId } = useParams<{ noradId: string }>();
  const { setSelectedSatellite, observerLocation } = useStore();
  const [satellite, setSatellite] = useState<SatelliteSummary | null>(null);
  const [tleInfo, setTleInfo] = useState<TleInfo | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('track');
  const [predictMinutes, setPredictMinutes] = useState(10);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [dopplerFreq, setDopplerFreq] = useState(437.55);

  const { position, loading, refresh } = useLivePosition(noradId || null);

  const now = new Date();
  const trackStart = formatISO(subHours(now, 1));
  const trackEnd   = formatISO(addHours(now, 1));
  const { track }  = useOrbitalTrack(noradId || null, trackStart, trackEnd, 30);

  const { passes, loading: passesLoading, error: passesError } = useSatellitePasses(
    activeTab === 'passes' ? noradId || null : null,
    observerLocation?.lat, observerLocation?.lon,
    { days: 3, minElevation: 10 }
  );

  const dopplerReq = (activeTab === 'doppler' && noradId && observerLocation)
    ? { noradId, observerLat: observerLocation.lat, observerLon: observerLocation.lon,
        observerAltMeters: (observerLocation.alt || 0) * 1000, frequencyMhz: dopplerFreq }
    : null;
  const { result: dopplerResult, loading: dopplerLoading, fetchCurrent } = useDoppler(dopplerReq);

  const { conjunctions } = useSatelliteConjunctions(
    activeTab === 'tle' ? null : noradId || null
  );

  useEffect(() => {
    if (!noradId) return;
    setSelectedSatellite(noradId);
    satelliteApi.get(noradId).then(setSatellite).catch(() => {});
    satelliteApi.tle(noradId).then(setTleInfo).catch(() => {});
  }, [noradId, setSelectedSatellite]);

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

  if (!noradId) return null;

  const positions = position ? { [noradId]: position } : {};

  const chartData = track?.points.slice(0, 60).map(p => ({
    time:     format(new Date(p.timestamp), 'HH:mm'),
    altitude: Math.round(p.altitudeKm),
    speed:    Number(p.speedKmPerS.toFixed(2)),
  })) || [];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'track',   label: 'Track'    },
    { key: 'predict', label: 'Predict'  },
    { key: 'passes',  label: 'Passes'   },
    { key: 'doppler', label: 'Doppler'  },
    { key: 'tle',     label: 'TLE Data' },
  ];

  /* ════════════════════════════════════════════════════════════
     FULLSCREEN MODE
     zIndex hierarchy:
       WorldMap internals  → max 460
       Fullscreen wrapper  → 9999
       Fullscreen header   → 10001  (always visible above map)
  ════════════════════════════════════════════════════════════ */
  if (mapFullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#020a18', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header bar — stays above everything in WorldMap */}
        <div style={{
          position: 'relative', zIndex: 10001,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 16px',
          background: 'rgba(2,6,20,.98)',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          {/* Left: name + live stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <span style={{
              fontFamily: "'Orbitron',monospace", fontSize: 13, fontWeight: 700,
              letterSpacing: 3, color: C.cyan, textShadow: `0 0 16px ${C.cyan}55`,
              whiteSpace: 'nowrap',
            }}>
              {satellite?.name || `NORAD ${noradId}`}
            </span>
            {position && (
              <span style={{
                fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
                color: C.muted, letterSpacing: 1, whiteSpace: 'nowrap',
              }}>
                {position.latitudeDeg.toFixed(3)}° / {position.longitudeDeg.toFixed(3)}°
                &nbsp;·&nbsp;{position.altitudeKm.toFixed(0)} km
                &nbsp;·&nbsp;{(position.speedKmPerS ?? 0).toFixed(2)} km/s
              </span>
            )}
            {/* ESC hint chip */}
            <span style={{
              fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
              color: 'rgba(0,200,255,.3)', letterSpacing: 1,
              border: '1px solid rgba(0,200,255,.12)', padding: '2px 7px',
              whiteSpace: 'nowrap',
            }}>
              ESC to exit
            </span>
          </div>

          {/* Right: exit button */}
          <button
            onClick={() => setMapFullscreen(false)}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 16px',
              background: 'rgba(255,51,68,.08)',
              border: '1px solid rgba(255,51,68,.35)',
              color: '#ff3344', cursor: 'pointer',
              fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 2,
              transition: 'all .18s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,51,68,.2)';
              e.currentTarget.style.boxShadow = '0 0 18px rgba(255,51,68,.35)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,51,68,.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Minimize2 style={{ width: 13, height: 13 }} />
            EXIT FULLSCREEN
          </button>
        </div>

        {/* Map — fills everything below the header */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <WorldMap
            positions={positions}
            trackPoints={track?.points}
            selectedNoradId={noradId}
          />
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     NORMAL LAYOUT
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 16px' }}>

      {/* Back link */}
      <Link
        to="/satellites"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 16, color: C.muted, fontSize: 13,
          fontFamily: "'Share Tech Mono',monospace", letterSpacing: 1,
          textDecoration: 'none', transition: 'color .2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        ALL SATELLITES
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <SatelliteInfoPanel
            satellite={satellite || undefined}
            position={position}
            loading={loading}
            onRefresh={refresh}
          />

          {conjunctions.length > 0 && (
            <Link to="/conjunctions" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: 'rgba(255,51,68,.08)', border: '1px solid rgba(255,51,68,.3)',
              color: '#ff3344', fontFamily: "'Share Tech Mono',monospace",
              fontSize: 11, letterSpacing: 1, textDecoration: 'none',
            }}>
              <AlertTriangle style={{ width: 13, height: 13 }} />
              {conjunctions.length} conjunction{conjunctions.length > 1 ? 's' : ''} detected →
            </Link>
          )}

          {/* Tabs */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {tabs.map(({ key, label }) => {
                const active = activeTab === key;
                return (
                  <button key={key} onClick={() => setActiveTab(key)} style={{
                    flexShrink: 0, padding: '10px 12px', fontSize: 10,
                    fontFamily: "'Share Tech Mono',monospace", letterSpacing: 1.5,
                    fontWeight: active ? 700 : 400,
                    color:  active ? C.cyan : C.muted,
                    background: active ? 'rgba(0,200,255,.06)' : 'transparent',
                    border: 'none',
                    borderBottom: active ? `2px solid ${C.cyan}` : '2px solid transparent',
                    cursor: 'pointer', transition: 'all .18s', textTransform: 'uppercase' as const,
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: 16 }}>
              {activeTab === 'track' && (
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
                  <p style={{ color: '#e2f0ff', marginBottom: 4 }}>Showing ±60 min orbit track</p>
                  <p>{track?.points.length || 0} track points computed</p>
                </div>
              )}

              {activeTab === 'predict' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: 1 }}>
                    PREDICT {predictMinutes} MIN AHEAD
                  </label>
                  <input type="range" min={1} max={360} value={predictMinutes}
                    onChange={e => setPredictMinutes(Number(e.target.value))}
                    style={{ width: '100%', accentColor: C.cyan }} />
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: C.muted, textAlign: 'right' }}>
                    {predictMinutes} minutes
                  </div>
                  <PredictButton noradId={noradId} minutes={predictMinutes} />
                </div>
              )}

              {activeTab === 'passes' && (
                <PassesPanel passes={passes} loading={passesLoading} error={passesError} hasObserver={!!(observerLocation?.lat)} />
              )}

              {activeTab === 'doppler' && (
                <DopplerPanel
                  noradId={noradId} freq={dopplerFreq} onFreqChange={setDopplerFreq}
                  result={dopplerResult} loading={dopplerLoading}
                  hasObserver={!!(observerLocation?.lat)} onFetch={fetchCurrent}
                />
              )}

              {activeTab === 'tle' && tleInfo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{
                    fontFamily: "'Share Tech Mono',monospace", fontSize: 11,
                    background: 'rgba(0,0,0,.4)', border: `1px solid ${C.border}`,
                    padding: 12, lineHeight: 1.9, wordBreak: 'break-all' as const,
                  }}>
                    <p style={{ color: C.muted, marginBottom: 4 }}># Epoch: {tleInfo.epoch}</p>
                    <p style={{ color: C.green }}>{tleInfo.line1}</p>
                    <p style={{ color: C.cyan  }}>{tleInfo.line2}</p>
                  </div>
                  <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: 'rgba(0,200,255,.3)' }}>
                    Source: {tleInfo.source}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Map + fullscreen button */}
          <div style={{
            position: 'relative', background: C.surface,
            border: `1px solid ${C.border}`, overflow: 'hidden', height: 480,
          }}>
            <WorldMap
              positions={positions}
              trackPoints={track?.points}
              selectedNoradId={noradId}
            />

            {/* ── FULLSCREEN BUTTON
                • bottom: 48px  → clears the Leaflet zoom control (≈ 80px tall, bottom-right)
                • right:  10px  → aligns with zoom control column
                • zIndex: 600   → above WorldMap's highest overlay at zIndex 460             */}
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
                color: C.cyan, cursor: 'pointer',
                fontFamily: "'Orbitron',monospace", fontSize: 8, letterSpacing: 2,
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 14px rgba(0,200,255,.18)',
                transition: 'all .18s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,200,255,.18)';
                e.currentTarget.style.boxShadow = '0 0 22px rgba(0,200,255,.45)';
                e.currentTarget.style.borderColor = C.cyan;
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

          {/* Altitude chart */}
          {chartData.length > 0 && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{
                fontFamily: "'Orbitron',monospace", fontSize: 10,
                letterSpacing: 2, color: C.muted, marginBottom: 12,
              }}>
                ALTITUDE PROFILE · ±60 MIN (km)
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,255,.06)" />
                  <XAxis dataKey="time"
                    tick={{ fontSize: 9, fill: 'rgba(140,180,210,.4)', fontFamily: "'Share Tech Mono',monospace" }}
                    tickLine={false} axisLine={{ stroke: C.border }} />
                  <YAxis
                    tick={{ fontSize: 9, fill: 'rgba(140,180,210,.4)', fontFamily: "'Share Tech Mono',monospace" }}
                    tickLine={false} axisLine={{ stroke: C.border }} domain={['auto','auto']} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(3,7,24,.97)', border: `1px solid ${C.border}`,
                      borderRadius: 2, fontSize: 11, fontFamily: "'Share Tech Mono',monospace" }}
                    labelStyle={{ color: C.muted }} itemStyle={{ color: C.cyan }} />
                  <Line type="monotone" dataKey="altitude" stroke={C.cyan}
                    strokeWidth={2} dot={false} name="Altitude (km)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(0,200,255,.2); border-radius:2px; }
      `}</style>
    </div>
  );
}

/* ── PASSES PANEL ─────────────────────────────────────────────────────────── */
function PassesPanel({ passes, loading, error, hasObserver }: {
  passes: ReturnType<typeof useSatellitePasses>['passes'];
  loading: boolean; error: string | null; hasObserver: boolean;
}) {
  if (!hasObserver) return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted,
      fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: 1, lineHeight: 2 }}>
      <Radio style={{ width: 24, height: 24, margin: '0 auto 8px', opacity: .3, display: 'block' }} />
      Set your location on the map<br />to see upcoming passes
    </div>
  );
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ height: 48,
          background: 'linear-gradient(90deg,rgba(0,200,255,.04),rgba(0,200,255,.08),rgba(0,200,255,.04))',
          backgroundSize: '300% 100%', animation: 'shimmer 1.8s infinite' }} />
      ))}
    </div>
  );
  if (error) return <div style={{ color: C.red, fontFamily: "'Share Tech Mono',monospace", fontSize: 11, padding: '8px 0' }}>{error}</div>;
  if (!passes.length) return (
    <div style={{ color: C.muted, fontFamily: "'Share Tech Mono',monospace", fontSize: 11, textAlign: 'center', padding: '16px 0' }}>
      No passes found in next 3 days
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
      {passes.slice(0, 10).map((p, i) => (
        <div key={i} style={{
          padding: '8px 10px',
          background: p.visible ? 'rgba(57,255,20,.04)' : 'rgba(0,200,255,.03)',
          border: `1px solid ${p.visible ? 'rgba(57,255,20,.2)' : 'rgba(0,200,255,.1)'}`,
          fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#e2f0ff', letterSpacing: 1 }}>{format(new Date(p.aos), 'MMM dd HH:mm:ss')}</span>
            <span style={{ color: C.orange, letterSpacing: 1, fontWeight: 'bold' }}>{p.maxElevation.toFixed(1)}° max</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted }}>
            <span>{p.aosDirection} → {p.losDirection}</span>
            <span>{p.durationLabel}</span>
          </div>
          {p.visible && <div style={{ marginTop: 3, color: C.green, fontSize: 9, letterSpacing: 1 }}>★ VISIBLE</div>}
        </div>
      ))}
    </div>
  );
}

/* ── DOPPLER PANEL ────────────────────────────────────────────────────────── */
function DopplerPanel({ noradId, freq, onFreqChange, result, loading, hasObserver, onFetch }: {
  noradId: string; freq: number; onFreqChange: (f: number) => void;
  result: ReturnType<typeof useDoppler>['result']; loading: boolean;
  hasObserver: boolean; onFetch: () => void;
}) {
  const PRESETS = [
    { label: 'ISS APRS',   freq: 145.825 },
    { label: 'ISS Voice',  freq: 437.550 },
    { label: 'NOAA-19',    freq: 137.100 },
    { label: '2m Amateur', freq: 145.500 },
    { label: '70cm UHF',   freq: 435.000 },
  ];
  if (!hasObserver) return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted,
      fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: 1, lineHeight: 2 }}>
      <Radio style={{ width: 24, height: 24, margin: '0 auto 8px', opacity: .3, display: 'block' }} />
      Set your location to calculate<br />Doppler shift
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>NOMINAL FREQUENCY (MHz)</div>
        <input type="number" value={freq} step="0.001" min="100" max="3000"
          onChange={e => onFreqChange(Number(e.target.value))}
          style={{ width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
            padding: '6px 10px', color: C.cyan, fontFamily: "'Share Tech Mono',monospace",
            fontSize: 14, letterSpacing: 1, outline: 'none', boxSizing: 'border-box' as const }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => onFreqChange(p.freq)} style={{
            padding: '3px 8px',
            background: freq === p.freq ? 'rgba(0,200,255,.15)' : 'rgba(0,200,255,.05)',
            border: `1px solid ${freq === p.freq ? C.cyan : C.border}`,
            color: freq === p.freq ? C.cyan : C.muted,
            fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 0.5, cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>
      <button onClick={onFetch} disabled={loading} style={{
        padding: '8px', background: 'rgba(0,200,255,.08)', border: `1px solid ${C.border}`,
        color: C.cyan, fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 2,
        cursor: 'pointer', opacity: loading ? 0.5 : 1, transition: 'all .2s',
      }}>
        {loading ? 'COMPUTING...' : 'COMPUTE DOPPLER'}
      </button>
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {([
            ['NOMINAL',    `${result.nominalFrequencyMhz.toFixed(3)} MHz`,   C.muted],
            ['OBSERVED',   `${result.observedFrequencyMhz.toFixed(6)} MHz`,  C.cyan],
            ['SHIFT',      `${result.dopplerShiftHz > 0 ? '+' : ''}${result.dopplerShiftHz.toFixed(1)} Hz`,
              result.dopplerShiftHz > 0 ? C.green : result.dopplerShiftHz < 0 ? C.orange : C.muted],
            ['RADIAL VEL', `${result.radialVelocityKms > 0 ? '+' : ''}${result.radialVelocityKms.toFixed(3)} km/s`,
              result.radialVelocityKms < 0 ? C.green : C.orange],
            ['ELEVATION',  `${result.elevationDeg.toFixed(1)}°`,             C.yellow],
            ['RANGE',      `${result.rangKm.toFixed(1)} km`,                 C.muted],
          ] as [string, string, string][]).map(([k, v, color]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid rgba(0,200,255,.06)` }}>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1, color: C.muted }}>{k}</span>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, fontWeight: 'bold', color }}>{v}</span>
            </div>
          ))}
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'rgba(0,200,255,.2)', textAlign: 'right', marginTop: 2 }}>
            {format(new Date(result.computedAt), 'HH:mm:ss')} UTC
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PREDICT BUTTON ───────────────────────────────────────────────────────── */
function PredictButton({ noradId, minutes }: { noradId: string; minutes: number }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const observerLocation = useStore(s => s.observerLocation);

  const predict = async () => {
    setLoading(true);
    try {
      const res = await satelliteApi.predict(noradId, minutes, observerLocation?.lat, observerLocation?.lon);
      const pos = res.position;
      setResult(`In ${minutes}min: ${pos.latitudeDeg.toFixed(2)}°, ${pos.longitudeDeg.toFixed(2)}° at ${pos.altitudeKm.toFixed(0)} km`);
    } catch { setResult('Prediction failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={predict} disabled={loading} style={{
        padding: '9px', background: loading ? 'rgba(0,200,255,.04)' : 'rgba(0,200,255,.1)',
        border: `1px solid ${C.border}`, color: C.cyan,
        fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 2,
        cursor: loading ? 'not-allowed' : 'pointer', transition: 'all .2s', opacity: loading ? 0.5 : 1,
      }}>
        {loading ? 'COMPUTING...' : 'PREDICT POSITION'}
      </button>
      {result && (
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: C.cyan,
          background: 'rgba(0,200,255,.06)', border: `1px solid ${C.border}`, padding: '8px 10px', lineHeight: 1.6 }}>
          {result}
        </div>
      )}
    </div>
  );
}
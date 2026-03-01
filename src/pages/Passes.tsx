import { useState, useCallback } from 'react';
import { Search, MapPin, Eye, EyeOff, Calendar, Clock, Navigation, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { trackingApi } from '../services/trackingApi';
import type { PassSummary } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

// ─── Color palette (matches existing app theme) ───────────────────────────────
const C = {
  cyan:    '#00d4ff',
  green:   '#39ff14',
  orange:  '#ff7e35',
  yellow:  '#ffd060',
  red:     '#ff3344',
  muted:   'rgba(140,180,210,.55)',
  border:  'rgba(0,200,255,.12)',
  surface: 'rgba(5,12,35,.9)',
};

const POPULAR_SATS = [
  { noradId: '25544', name: 'ISS (ZARYA)', freq: 145.825 },
  { noradId: '33591', name: 'NOAA 19',    freq: 137.100 },
  { noradId: '28654', name: 'NOAA 18',    freq: 137.913 },
  { noradId: '25338', name: 'NOAA 15',    freq: 137.620 },
  { noradId: '20580', name: 'Hubble',     freq: 0 },
  { noradId: '43226', name: 'CSS Tianhe', freq: 0 },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${C.cyan}44,transparent)` }} />
      <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, letterSpacing: 4, color: `${C.cyan}99` }}>{children}</span>
      <div style={{ width: 4, height: 4, background: C.cyan, boxShadow: `0 0 6px ${C.cyan}` }} />
    </div>
  );
}

export function Passes() {
  // ── Pull cache from store alongside existing store values ─────────────────
  const { observerLocation, setObserverLocation, passesCache, setPassesCache } = useStore();

  // Observer form state — seed from cache if available, fallback to original logic
  const [lat, setLat] = useState(passesCache?.lat?.toString() ?? observerLocation?.lat?.toString() ?? '');
  const [lon, setLon] = useState(passesCache?.lon?.toString() ?? observerLocation?.lon?.toString() ?? '');
  const [alt, setAlt] = useState(passesCache?.alt?.toString() ?? '0');
  const [days, setDays] = useState(passesCache?.days ?? 3);
  const [minEl, setMinEl] = useState(passesCache?.minEl ?? 10);
  const [visibleOnly, setVisibleOnly] = useState(passesCache?.visibleOnly ?? false);

  // Satellite selection — seed from cache if available
  const [noradId, setNoradId] = useState(passesCache?.noradId ?? '25544');
  const [noradInput, setNoradInput] = useState(passesCache?.noradId ?? '25544');

  // Results — restored from cache immediately, no re-fetch needed
  const [passes, setPasses] = useState<PassSummary[]>(passesCache?.passes ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computed, setComputed] = useState(passesCache !== null);

  // Locate me — unchanged
  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude, altitude } = pos.coords;
      setLat(latitude.toFixed(6));
      setLon(longitude.toFixed(6));
      setAlt(((altitude ?? 0) / 1000).toFixed(3));
      setObserverLocation({ lat: latitude, lon: longitude, alt: (altitude ?? 0) / 1000, label: 'My Location' });
    });
  };

  const predict = useCallback(async () => {
    const latN = parseFloat(lat), lonN = parseFloat(lon), altN = parseFloat(alt) || 0;
    if (isNaN(latN) || isNaN(lonN)) { setError('Enter valid coordinates'); return; }

    setLoading(true);
    setError(null);
    try {
      const result = await trackingApi.predictPasses({
        noradId: noradInput.trim(),
        observerLat: latN,
        observerLon: lonN,
        observerAltMeters: altN * 1000,  // km → m
        days,
        minElevation: minEl,
        visibleOnly,
      });
      setPasses(result);
      setComputed(true);
      setObserverLocation({ lat: latN, lon: lonN, alt: altN, label: `${latN.toFixed(3)}°, ${lonN.toFixed(3)}°` });

      // ── Save results to store so they survive navigation ──────────────────
      setPassesCache({
        passes: result,
        noradId: noradInput.trim(),
        lat: latN,
        lon: lonN,
        alt: altN,
        days,
        minEl,
        visibleOnly,
        computedAt: new Date().toISOString(),
      });
    } catch {
      setError('Pass prediction failed — check NORAD ID and coordinates');
    } finally {
      setLoading(false);
    }
  }, [lat, lon, alt, days, minEl, visibleOnly, noradInput, setObserverLocation, setPassesCache]);

  const visibleCount = passes.filter(p => p.visible).length;

  // Cache age for the hint label
  const cacheAge = passesCache
    ? Math.floor((Date.now() - new Date(passesCache.computedAt).getTime()) / 60_000)
    : null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <Radio style={{ width: 22, height: 22, color: C.cyan, filter: `drop-shadow(0 0 6px ${C.cyan})` }} />
          <h1 style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, fontWeight: 900, letterSpacing: 4, color: '#fff', textShadow: '0 0 20px rgba(0,200,255,.4)', margin: 0 }}>
            PASS <span style={{ color: C.cyan }}>PREDICTIONS</span>
          </h1>
        </div>
        <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: C.muted, letterSpacing: 1, margin: 0 }}>
          Compute upcoming overhead passes for any ground observer location
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT: Config panel ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `2px solid ${C.cyan}`, padding: 16 }}>

          <SectionLabel>SATELLITE</SectionLabel>

          {/* Quick-select popular sats */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {POPULAR_SATS.map(s => (
              <button key={s.noradId} onClick={() => setNoradInput(s.noradId)} style={{
                padding: '3px 8px',
                background: noradInput === s.noradId ? 'rgba(0,200,255,.15)' : 'rgba(0,200,255,.04)',
                border: `1px solid ${noradInput === s.noradId ? C.cyan : C.border}`,
                color: noradInput === s.noradId ? C.cyan : C.muted,
                fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 0.5, cursor: 'pointer',
              }}>
                {s.name}
              </button>
            ))}
          </div>

          {/* Manual NORAD input */}
          <div style={{ marginBottom: 2 }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>NORAD ID</div>
            <input
              value={noradInput}
              onChange={e => setNoradInput(e.target.value)}
              placeholder="e.g. 25544"
              style={{
                width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
                padding: '7px 10px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace",
                fontSize: 13, outline: 'none',
              }}
            />
          </div>

          <SectionLabel>OBSERVER LOCATION</SectionLabel>

          {/* Locate me */}
          <button onClick={locateMe} style={{
            width: '100%', padding: '7px', marginBottom: 10,
            background: 'rgba(0,255,136,.05)', border: '1px solid rgba(0,255,136,.2)',
            color: '#00ff88', fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: 2,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <MapPin style={{ width: 12, height: 12 }} />
            USE MY LOCATION
          </button>

          {/* Lat/Lon/Alt */}
          {[
            { label: 'LATITUDE', value: lat, set: setLat, placeholder: '0.000000' },
            { label: 'LONGITUDE', value: lon, set: setLon, placeholder: '0.000000' },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>{label}</div>
              <input
                type="number"
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
                  padding: '6px 10px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 12, outline: 'none',
                }}
              />
            </div>
          ))}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>ALTITUDE (km)</div>
            <input
              type="number"
              value={alt}
              onChange={e => setAlt(e.target.value)}
              placeholder="0"
              style={{
                width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
                padding: '6px 10px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace",
                fontSize: 12, outline: 'none',
              }}
            />
          </div>

          <SectionLabel>FILTERS</SectionLabel>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>DAYS AHEAD</div>
              <select value={days} onChange={e => setDays(Number(e.target.value))} style={{
                width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
                padding: '6px 8px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace", fontSize: 11, outline: 'none',
              }}>
                {[1,2,3,5,7,10].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>MIN ELEVATION</div>
              <select value={minEl} onChange={e => setMinEl(Number(e.target.value))} style={{
                width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
                padding: '6px 8px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace", fontSize: 11, outline: 'none',
              }}>
                {[5,10,15,20,30,45].map(d => <option key={d} value={d}>{d}°</option>)}
              </select>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={visibleOnly}
              onChange={e => setVisibleOnly(e.target.checked)}
              style={{ accentColor: C.cyan }}
            />
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: 1 }}>
              VISIBLE PASSES ONLY
            </span>
          </label>

          {/* Compute button */}
          <button
            onClick={predict}
            disabled={loading}
            style={{
              width: '100%', padding: '10px', cursor: 'pointer',
              background: loading ? 'rgba(0,200,255,.05)' : 'rgba(0,200,255,.12)',
              border: `1px solid ${loading ? C.border : C.cyan}`,
              color: loading ? C.muted : C.cyan,
              fontFamily: "'Orbitron',monospace", fontSize: 11, letterSpacing: 3, fontWeight: 700,
              boxShadow: loading ? 'none' : `0 0 20px rgba(0,200,255,.2)`,
              transition: 'all 0.2s',
            }}
          >
            {loading ? '◉  COMPUTING...' : '▶  COMPUTE PASSES'}
          </button>

          {error && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(255,51,68,.08)', border: '1px solid rgba(255,51,68,.3)', color: C.red, fontFamily: "'Share Tech Mono',monospace", fontSize: 10 }}>
              {error}
            </div>
          )}

          {/* Cache staleness hint — only shown when results are cached */}
          {cacheAge !== null && !loading && (
            <div style={{
              marginTop: 8, padding: '5px 8px',
              background: 'rgba(0,200,255,.03)', border: `1px solid ${C.border}`,
              fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{cacheAge < 1 ? 'computed just now' : `computed ${cacheAge}m ago`}</span>
              <button
                onClick={() => { useStore.getState().clearPassesCache(); setPasses([]); setComputed(false); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,68,102,.6)', fontFamily: "'Share Tech Mono',monospace", fontSize: 9, cursor: 'pointer', letterSpacing: 1, padding: 0 }}
              >
                CLEAR
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Results ── */}
        <div>
          {!computed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, opacity: 0.4 }}>
              <Radio style={{ width: 56, height: 56, color: C.cyan }} />
              <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 4, color: C.cyan }}>
                CONFIGURE AND COMPUTE
              </span>
            </div>
          ) : (
            <>
              {/* Stats bar */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'TOTAL PASSES',    value: passes.length,     color: C.cyan },
                  { label: 'VISIBLE',          value: visibleCount,      color: C.green },
                  { label: 'INVISIBLE',        value: passes.length - visibleCount, color: C.muted },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '8px 16px', background: C.surface, border: `1px solid ${C.border}`, flex: '1 0 auto' }}>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Pass list */}
              {passes.length === 0 ? (
                <div style={{ textAlign: 'center', color: C.muted, fontFamily: "'Share Tech Mono',monospace", fontSize: 12, padding: 40 }}>
                  No passes found with these settings
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {passes.map((p, i) => (
                    <PassCard key={i} pass={p} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PassCard({ pass }: { pass: PassSummary }) {
  const [expanded, setExpanded] = useState(false);
  const aosDate = new Date(pass.aos);
  const isFuture = aosDate > new Date();

  return (
    <div style={{
      background: pass.visible ? 'rgba(57,255,20,.03)' : C.surface,
      border: `1px solid ${pass.visible ? 'rgba(57,255,20,.25)' : C.border}`,
      borderLeft: `3px solid ${pass.visible ? '#39ff14' : 'rgba(0,200,255,.3)'}`,
      overflow: 'hidden',
    }}>
      {/* Main row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', padding: '10px 14px', gap: 16, cursor: 'pointer' }}
      >
        {/* Date/time */}
        <div>
          <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 12, color: '#e2f0ff', letterSpacing: 1 }}>
            {format(aosDate, 'MMM dd')}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 13, color: '#00d4ff', letterSpacing: 1, fontWeight: 'bold' }}>
            {format(aosDate, 'HH:mm:ss')} UTC
          </div>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, marginTop: 1 }}>
            {isFuture ? formatDistanceToNow(aosDate, { addSuffix: true }) : 'passed'}
          </div>
        </div>

        {/* Max elevation */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: C.muted, letterSpacing: 1 }}>MAX EL</div>
          <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 18, fontWeight: 900,
            color: pass.maxElevation >= 60 ? C.green : pass.maxElevation >= 30 ? C.yellow : C.orange }}>
            {pass.maxElevation.toFixed(0)}°
          </div>
        </div>

        {/* Duration */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: C.muted, letterSpacing: 1 }}>DUR</div>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: '#e2f0ff' }}>{pass.durationLabel}</div>
        </div>

        {/* Visible badge */}
        <div>
          {pass.visible ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(57,255,20,.1)', border: '1px solid rgba(57,255,20,.3)', color: '#39ff14', fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1 }}>
              <Eye style={{ width: 9, height: 9 }} /> VIS
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(140,180,210,.04)', border: '1px solid rgba(140,180,210,.1)', color: C.muted, fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1 }}>
              <EyeOff style={{ width: 9, height: 9 }} /> —
            </span>
          )}
        </div>

        {expanded
          ? <ChevronUp style={{ width: 14, height: 14, color: C.muted }} />
          : <ChevronDown style={{ width: 14, height: 14, color: C.muted }} />
        }
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(0,200,255,.06)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            ['AOS', format(new Date(pass.aos), 'HH:mm:ss'), `${pass.aosAzimuth.toFixed(0)}° ${pass.aosDirection}`, C.cyan],
            ['TCA', format(new Date(pass.tca), 'HH:mm:ss'), `${pass.tcaAzimuth.toFixed(0)}°`, C.yellow],
            ['LOS', format(new Date(pass.los), 'HH:mm:ss'), `${pass.losAzimuth.toFixed(0)}° ${pass.losDirection}`, C.orange],
          ].map(([label, time, az, color]) => (
            <div key={label as string} style={{ marginTop: 8 }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 12, color: color as string }}>{time}</div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: C.muted }}>{az}</div>
            </div>
          ))}
          {pass.magnitude != null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>MAGNITUDE</div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 12, color: C.yellow }}>{pass.magnitude.toFixed(1)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
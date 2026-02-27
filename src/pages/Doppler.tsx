/**
 * Doppler.tsx
 *
 * Backend DTO reference:
 *
 * REQUEST  → DopplerRequest:
 *   noradId, observerLat, observerLon, observerAltMeters, frequencyMhz
 *
 * RESPONSE ← DopplerResult:
 *   noradId, nominalFrequencyMhz, dopplerShiftHz, observedFrequencyMhz,
 *   radialVelocityKms, elevationDeg, rangKm, computedAt
 */

import { useState, useCallback } from 'react';
import { useDoppler } from '../hooks';
import type { DopplerRequest } from '../types';
import { Activity, Radio, MapPin, Zap, ChevronRight } from 'lucide-react';

// ─── SVG curve chart ──────────────────────────────────────────────────────────
function DopplerCurveChart({ data }: {
  data: Array<{ dopplerShiftHz?: number; computedAt?: string }>;
}) {
  if (!data.length) return null;

  const W = 700, H = 180;
  const P = { top: 20, right: 24, bottom: 36, left: 68 };

  const shifts = data.map(d => d.dopplerShiftHz ?? 0);
  const minHz = Math.min(...shifts);
  const maxHz = Math.max(...shifts);
  const range = maxHz - minHz || 1;

  const toX = (i: number) => P.left + (i / (data.length - 1)) * (W - P.left - P.right);
  const toY = (v: number) => P.top + (1 - (v - minHz) / range) * (H - P.top - P.bottom);

  const pts = data.map((d, i) => `${toX(i)},${toY(d.dopplerShiftHz ?? 0)}`).join(' ');
  const zeroY = toY(0);
  const lbls = [0, Math.floor(data.length / 2), data.length - 1];

  const fmtHz = (v: number) => Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)} kHz` : `${v.toFixed(0)} Hz`;
  const fmtT  = (s?: string) => { try { return s ? new Date(s).toISOString().slice(11,19) : ''; } catch { return ''; } };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, overflow: 'visible' }}>
      <defs>
        <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00c8ff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#00c8ff" stopOpacity="0.01" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {[0,.25,.5,.75,1].map(t => {
        const y = P.top + t * (H - P.top - P.bottom);
        return (
          <g key={t}>
            <line x1={P.left} y1={y} x2={W-P.right} y2={y} stroke="rgba(0,200,255,.08)" strokeWidth={1}/>
            <text x={P.left-8} y={y+4} textAnchor="end" fill="rgba(0,200,255,.4)"
              fontSize={9} fontFamily="'Share Tech Mono',monospace">{fmtHz(maxHz - t*range)}</text>
          </g>
        );
      })}

      {zeroY >= P.top && zeroY <= H - P.bottom && (
        <line x1={P.left} y1={zeroY} x2={W-P.right} y2={zeroY}
          stroke="rgba(0,255,136,.25)" strokeWidth={1} strokeDasharray="4 4"/>
      )}

      <polygon points={`${P.left},${H-P.bottom} ${pts} ${W-P.right},${H-P.bottom}`} fill="url(#dg)"/>
      <polyline points={pts} fill="none" stroke="#00c8ff" strokeWidth={1.8} filter="url(#glow)"/>

      {data.length <= 30 && data.map((d, i) => (
        <circle key={i} cx={toX(i)} cy={toY(d.dopplerShiftHz ?? 0)} r={3} fill="#00c8ff" opacity={0.8}/>
      ))}

      {lbls.map(idx => (
        <text key={idx} x={toX(idx)} y={H-P.bottom+18} textAnchor="middle"
          fill="rgba(0,200,255,.4)" fontSize={9} fontFamily="'Share Tech Mono',monospace">
          {fmtT(data[idx]?.computedAt)}
        </text>
      ))}

      <line x1={P.left} y1={P.top} x2={P.left} y2={H-P.bottom} stroke="rgba(0,200,255,.2)" strokeWidth={1}/>
      <line x1={P.left} y1={H-P.bottom} x2={W-P.right} y2={H-P.bottom} stroke="rgba(0,200,255,.2)" strokeWidth={1}/>
    </svg>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', placeholder = '', unit, step, min }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; unit?: string; step?: string; min?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
        letterSpacing: 2, color: 'rgba(0,200,255,.5)' }}>{label}</span>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input type={type} value={value} step={step} min={min} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          style={{ width: '100%', background: 'rgba(0,200,255,.04)',
            border: '1px solid rgba(0,200,255,.18)',
            padding: unit ? '7px 48px 7px 10px' : '7px 10px',
            color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace",
            fontSize: 12, outline: 'none', borderRadius: 0, appearance: 'none' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,200,255,.5)'; }}
          onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(0,200,255,.18)'; }}
        />
        {unit && (
          <span style={{ position: 'absolute', right: 10, fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, color: 'rgba(0,200,255,.4)', pointerEvents: 'none' }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, highlight, positive }: {
  label: string; value: string; sub?: string; highlight?: boolean; positive?: boolean;
}) {
  return (
    <div style={{ background: highlight ? 'rgba(0,200,255,.07)' : 'rgba(0,200,255,.03)',
      border: `1px solid ${highlight ? 'rgba(0,200,255,.35)' : 'rgba(0,200,255,.12)'}`,
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4,
      position: 'relative', overflow: 'hidden' }}>
      {highlight && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, #00c8ff, transparent)' }}/>
      )}
      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
        letterSpacing: 2, color: 'rgba(0,200,255,.45)' }}>{label}</span>
      <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, fontWeight: 700,
        color: highlight ? '#00c8ff'
          : positive === undefined ? '#e2f0ff'
          : positive ? '#00ff88' : '#ff4466',
        textShadow: highlight ? '0 0 20px rgba(0,200,255,.4)' : undefined }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, color: 'rgba(150,190,220,.4)' }}>{sub}</span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function Doppler() {
  const [noradId, setNoradId] = useState('25544');
  const [lat,     setLat]     = useState('');
  const [lon,     setLon]     = useState('');
  const [alt,     setAlt]     = useState('0');
  const [freqMhz, setFreqMhz] = useState('437.550');
  const [passStart, setPassStart] = useState('');
  const [passEnd,   setPassEnd]   = useState('');

  // ── Build request — uses exact DTO field name: frequencyMhz ───────────────
  const buildReq = useCallback((): DopplerRequest | null => {
    const pLat = parseFloat(lat);
    const pLon = parseFloat(lon);
    if (!noradId || isNaN(pLat) || isNaN(pLon)) return null;
    return {
      noradId,
      observerLat:       pLat,
      observerLon:       pLon,
      observerAltMeters: (parseFloat(alt) || 0) * 1000, // km → m
      frequencyMhz:      parseFloat(freqMhz),            // ✅ exact DTO field
    } as unknown as DopplerRequest;
  }, [noradId, lat, lon, alt, freqMhz]);

  const req = buildReq();
  const { result, curve, loading, error, fetchCurrent, fetchCurve } = useDoppler(req);

  const locateAndFill = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      setLat(pos.coords.latitude.toFixed(5));
      setLon(pos.coords.longitude.toFixed(5));
      setAlt(((pos.coords.altitude ?? 0) / 1000).toFixed(3));
    });
  };

  const canSubmit = !!req && !loading;
  const canCurve  = canSubmit && !!passStart && !!passEnd;

  // ── Formatters ────────────────────────────────────────────────────────────
  const fmtShift = (hz?: number) => {
    if (hz == null) return '—';
    const sign = hz >= 0 ? '+' : '';
    return Math.abs(hz) >= 1000
      ? `${sign}${(hz / 1000).toFixed(3)} kHz`
      : `${sign}${hz.toFixed(1)} Hz`;
  };
  const fmtMhz = (mhz?: number) => mhz == null ? '—' : `${mhz.toFixed(6)} MHz`;

  // ── Read backend response fields — exact DTO names ────────────────────────
  const r          = result as any;
  const shift      = r?.dopplerShiftHz      as number | undefined;
  const obsFreq    = r?.observedFrequencyMhz as number | undefined;
  const radialV    = r?.radialVelocityKms   as number | undefined;
  const elev       = r?.elevationDeg        as number | undefined;
  const rangKm     = r?.rangKm              as number | undefined;
  const computedAt = r?.computedAt          as string | undefined;

  const curveAny    = curve as any[];
  const curveShifts = curveAny.map(d => (d.dopplerShiftHz ?? 0) as number);

  return (
    <div style={{ minHeight: '100vh', background: '#030712',
      padding: '32px 24px 64px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ width: 44, height: 44, flexShrink: 0,
          border: '1px solid rgba(0,200,255,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,200,255,.06)' }}>
          <Radio style={{ width: 20, height: 20, color: '#00c8ff' }} />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Orbitron',monospace", fontSize: 22, fontWeight: 900,
            letterSpacing: 4, color: '#fff', textShadow: '0 0 30px rgba(0,200,255,.4)', margin: 0 }}>
            DOPPLER ANALYSIS
          </h1>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: 2,
            color: 'rgba(0,200,255,.4)', margin: '4px 0 0' }}>
            REAL-TIME FREQUENCY SHIFT · PASS CURVE · RANGE RATE
          </p>
        </div>
      </div>

      {/* Input panel */}
      <div style={{ border: '1px solid rgba(0,200,255,.15)', background: 'rgba(0,200,255,.02)',
        padding: '24px', marginBottom: 28, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(0,200,255,.3),transparent)' }}/>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 3,
          color: 'rgba(0,200,255,.4)', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap style={{ width: 11, height: 11 }}/> PARAMETERS
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="NORAD CATALOG ID" value={noradId} onChange={setNoradId} placeholder="e.g. 25544"/>
          <Field label="NOMINAL TX FREQUENCY" value={freqMhz} onChange={setFreqMhz}
            type="number" step="0.001" unit="MHz"/>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <Field label="OBSERVER LAT" value={lat} onChange={setLat}
            type="number" step="0.00001" placeholder="e.g. 40.7128" unit="°"/>
          <Field label="OBSERVER LON" value={lon} onChange={setLon}
            type="number" step="0.00001" placeholder="e.g. -74.0060" unit="°"/>
          <Field label="ALTITUDE" value={alt} onChange={setAlt}
            type="number" step="0.001" min="0" unit="km"/>
          <button onClick={locateAndFill}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              background: 'rgba(0,200,255,.08)', border: '1px solid rgba(0,200,255,.25)',
              color: '#00c8ff', fontFamily: "'Share Tech Mono',monospace",
              fontSize: 10, letterSpacing: 2, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <MapPin style={{ width: 11, height: 11 }}/> LOCATE
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <button onClick={fetchCurrent} disabled={!canSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 28px',
              background: canSubmit ? 'rgba(0,200,255,.12)' : 'rgba(0,200,255,.03)',
              border: `1px solid ${canSubmit ? 'rgba(0,200,255,.5)' : 'rgba(0,200,255,.1)'}`,
              color: canSubmit ? '#00c8ff' : 'rgba(0,200,255,.25)',
              fontFamily: "'Orbitron',monospace", fontSize: 11, letterSpacing: 3, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'all .2s' }}>
            {loading
              ? <><span style={{ animation: '__spin 1s linear infinite', display: 'inline-block' }}>◌</span> CALCULATING...</>
              : <><Activity style={{ width: 13, height: 13 }}/> CALCULATE NOW</>
            }
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ border: '1px solid rgba(255,68,102,.3)', background: 'rgba(255,68,102,.06)',
          padding: '12px 20px', marginBottom: 20, fontFamily: "'Share Tech Mono',monospace",
          fontSize: 11, color: '#ff4466', letterSpacing: 1 }}>
          ⚠ {error}
        </div>
      )}

      {/* Result cards */}
      {result && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 3,
            color: 'rgba(0,200,255,.4)', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88',
              boxShadow: '0 0 8px #00ff88', display: 'inline-block', animation: '__blink 2s infinite' }}/>
            LIVE DOPPLER RESULT
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <StatCard
              label="DOPPLER SHIFT"
              value={fmtShift(shift)}
              sub={shift != null ? (shift > 0 ? 'APPROACHING' : shift < 0 ? 'RECEDING' : 'STATIONARY') : ''}
              highlight
              positive={shift != null ? shift > 0 : undefined}
            />
            <StatCard
              label="OBSERVED FREQUENCY"
              value={fmtMhz(obsFreq)}
              sub="doppler-corrected"
            />
            <StatCard
              label="RADIAL VELOCITY"
              value={radialV != null ? `${radialV.toFixed(3)} km/s` : '—'}
              sub={radialV != null ? (radialV < 0 ? 'CLOSING' : 'OPENING') : ''}
              positive={radialV != null ? radialV < 0 : undefined}
            />
            <StatCard
              label="ELEVATION"
              value={elev != null ? `${elev.toFixed(2)}°` : '—'}
              sub={elev != null ? (elev > 0 ? 'ABOVE HORIZON' : 'BELOW HORIZON') : ''}
              positive={elev != null ? elev > 0 : undefined}
            />
            <StatCard
              label="RANGE"
              value={rangKm != null ? `${Math.round(rangKm).toLocaleString()} km` : '—'}
              sub="slant range"
            />
            {computedAt && (
              <StatCard
                label="COMPUTED AT"
                value={new Date(computedAt).toISOString().slice(11, 19)}
                sub={new Date(computedAt).toISOString().slice(0, 10) + ' UTC'}
              />
            )}
          </div>
        </div>
      )}

      {/* Doppler curve */}
      <div style={{ border: '1px solid rgba(0,200,255,.12)', background: 'rgba(0,200,255,.015)',
        padding: '24px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(0,200,255,.2),transparent)' }}/>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 3,
          color: 'rgba(0,200,255,.4)', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity style={{ width: 11, height: 11 }}/> DOPPLER CURVE — PASS WINDOW
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto',
          gap: 12, alignItems: 'end', marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
              letterSpacing: 2, color: 'rgba(0,200,255,.5)' }}>PASS START (UTC)</span>
            <input type="datetime-local" value={passStart} onChange={e => setPassStart(e.target.value)}
              style={{ background: 'rgba(0,200,255,.04)', border: '1px solid rgba(0,200,255,.18)',
                padding: '7px 10px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace",
                fontSize: 12, outline: 'none', borderRadius: 0, colorScheme: 'dark' }}/>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
              letterSpacing: 2, color: 'rgba(0,200,255,.5)' }}>PASS END (UTC)</span>
            <input type="datetime-local" value={passEnd} onChange={e => setPassEnd(e.target.value)}
              style={{ background: 'rgba(0,200,255,.04)', border: '1px solid rgba(0,200,255,.18)',
                padding: '7px 10px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace",
                fontSize: 12, outline: 'none', borderRadius: 0, colorScheme: 'dark' }}/>
          </div>
          <button
            onClick={() => {
              if (!passStart || !passEnd) return;
              fetchCurve(new Date(passStart).toISOString(), new Date(passEnd).toISOString());
            }}
            disabled={!canCurve}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
              background: canCurve ? 'rgba(0,200,255,.1)' : 'rgba(0,200,255,.03)',
              border: `1px solid ${canCurve ? 'rgba(0,200,255,.4)' : 'rgba(0,200,255,.1)'}`,
              color: canCurve ? '#00c8ff' : 'rgba(0,200,255,.2)',
              fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 2, fontWeight: 700,
              cursor: canCurve ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
            <ChevronRight style={{ width: 12, height: 12 }}/> PLOT CURVE
          </button>
        </div>

        {curve.length > 0 ? (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2,
              color: 'rgba(0,200,255,.3)', marginBottom: 12 }}>
              FREQUENCY SHIFT OVER PASS · {curve.length} SAMPLES
            </div>
            <DopplerCurveChart data={curveAny}/>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 8, marginTop: 20 }}>
              <StatCard label="PEAK POSITIVE SHIFT" value={fmtShift(Math.max(...curveShifts))} sub="max approach"/>
              <StatCard label="PEAK NEGATIVE SHIFT" value={fmtShift(Math.min(...curveShifts))} sub="max recession"/>
              <StatCard label="TOTAL SHIFT RANGE"
                value={fmtShift(Math.max(...curveShifts) - Math.min(...curveShifts))} sub="peak-to-peak"/>
              <StatCard label="SAMPLES" value={String(curve.length)} sub="over pass window"/>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px dashed rgba(0,200,255,.1)', padding: '40px 24px',
            textAlign: 'center', color: 'rgba(0,200,255,.2)',
            fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: 2 }}>
            SELECT A PASS WINDOW AND CLICK PLOT CURVE TO VISUALISE THE DOPPLER SHIFT ACROSS THE ENTIRE PASS
          </div>
        )}
      </div>

      {/* Footer info */}
      <div style={{ marginTop: 28, padding: '16px 20px',
        border: '1px solid rgba(0,200,255,.08)', background: 'rgba(0,0,0,.2)',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[
          { label: 'MODEL',   value: 'SGP4 / WGS-84' },
          { label: 'METHOD',  value: 'Non-relativistic Doppler' },
          { label: 'REF',     value: 'NORAD TLE Catalog' },
          { label: 'FORMULA', value: 'Δf = −f₀ · v_r / c' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8,
              letterSpacing: 2, color: 'rgba(0,200,255,.3)' }}>{label}</span>
            <span style={{ fontFamily: "'Share Tech Mono',monospace",
              fontSize: 11, color: 'rgba(0,200,255,.5)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
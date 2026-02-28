import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navigation, Gauge, Mountain, Clock, Eye, EyeOff, Radio, Star, StarOff, RefreshCw, ExternalLink, Crosshair, RotateCcw, Activity } from 'lucide-react';
import type { SatellitePosition, SatelliteSummary } from '../types';
import { useStore } from '../stores/useStore';
import { format, formatDistanceToNow } from 'date-fns';

interface Props {
  satellite?: SatelliteSummary;
  position?: SatellitePosition | null;
  loading?: boolean;
  onRefresh?: () => void;
}

const C = {
  accent:  '#00c8ff',
  orange:  '#ff7e35',
  green:   '#00ff88',
  yellow:  '#ffd060',
  muted:   'rgba(140,180,210,.55)',
  border:  'rgba(0,200,255,.12)',
  surface: 'rgba(5,12,35,.9)',
};

function Row({ icon, label, value, color = C.accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid rgba(0,200,255,.06)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C.muted, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: 1.5, color: C.muted, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 13, fontWeight: 'bold', color, textShadow: `0 0 10px ${color}88` }}>{value}</span>
    </div>
  );
}

function SectionLabel({ children, color = C.accent }: { children: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 6px' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${color}44,transparent)` }} />
      <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, letterSpacing: 4, color: `${color}99`, whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ width: 4, height: 4, background: color, boxShadow: `0 0 6px ${color}` }} />
    </div>
  );
}

export function SatelliteInfoPanel({ satellite, position, loading, onRefresh }: Props) {
  const { addFavorite, removeFavorite, isFavorite } = useStore();
  const isFav = satellite ? isFavorite(satellite.noradId) : false;
  const toggleFav = () => satellite && (isFav ? removeFavorite(satellite.noradId) : addFavorite(satellite));

  /* empty */
  if (!position && !loading) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `2px solid rgba(0,200,255,.2)`, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 12 }}>
        <Crosshair style={{ width: 32, height: 32, color: 'rgba(0,200,255,.2)' }} />
        <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 4, color: 'rgba(0,200,255,.25)' }}>SELECT A SATELLITE</span>
      </div>
    );
  }

  const overhead = position?.lookAngles?.visible;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `2px solid ${C.accent}`, overflow: 'hidden', backdropFilter: 'blur(16px)' }}>

      {/* HEADER */}
      <div style={{ padding: '14px 16px 12px', background: 'rgba(0,200,255,.03)', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {overhead && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 5, padding: '2px 8px', background: 'rgba(0,255,136,.08)', border: '1px solid rgba(0,255,136,.25)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}`, display: 'inline-block', animation: '__blink 1.5s infinite' }} />
                <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, letterSpacing: 3, color: C.green }}>OVERHEAD NOW</span>
              </div>
            )}
            <h2 style={{ fontFamily: "'Orbitron',monospace", fontWeight: 700, fontSize: 14, letterSpacing: 2, color: '#fff', textShadow: '0 0 16px rgba(0,200,255,.5)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loading ? <span style={{ opacity: .4 }}>LOADING...</span> : (position?.name || satellite?.name || '—')}
            </h2>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: 2, color: C.muted }}>
              NORAD <span style={{ color: C.orange, fontWeight: 'bold' }}>{position?.noradId || satellite?.noradId || '—'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
            {satellite && (
              <button onClick={toggleFav} style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', padding: 7, color: isFav ? C.yellow : C.muted, display: 'flex', transition: 'all .2s' }}>
                {isFav ? <Star style={{ width: 14, height: 14, fill: 'currentColor' }} /> : <StarOff style={{ width: 14, height: 14 }} />}
              </button>
            )}
            <button onClick={onRefresh} disabled={loading} style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', padding: 7, color: C.muted, display: 'flex' }}>
              <RefreshCw style={{ width: 14, height: 14, animation: loading ? '__spin 1s linear infinite' : 'none' }} />
            </button>
            {satellite && (
              <Link to={`/satellites/${satellite.noradId}`} style={{ display: 'flex', alignItems: 'center', padding: 7, color: C.muted, border: '1px solid transparent' }}>
                <ExternalLink style={{ width: 14, height: 14 }} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: '4px 16px 16px' }}>
        {loading ? (
          <>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ height: 28, margin: '6px 0', background: 'linear-gradient(90deg,rgba(0,200,255,.04),rgba(0,200,255,.08),rgba(0,200,255,.04))', backgroundSize: '300% 100%', animation: '__shimmer 1.8s ease infinite' }} />
            ))}
          </>
        ) : position ? (
          <>
            <SectionLabel>ORBITAL POSITION</SectionLabel>

            <Row icon={<Navigation style={{ width: 11, height: 11 }} />} label="Latitude"  value={`${position.latitudeDeg.toFixed(4)}°`} />
            <Row icon={<Navigation style={{ width: 11, height: 11, transform: 'rotate(90deg)' }} />} label="Longitude" value={`${position.longitudeDeg.toFixed(4)}°`} />
            <Row icon={<Mountain   style={{ width: 11, height: 11 }} />} label="Altitude"  value={`${position.altitudeKm.toFixed(1)} km`}         color={C.orange} />
            <Row icon={<Gauge      style={{ width: 11, height: 11 }} />} label="Speed"     value={`${(position.speedKmPerS ?? 0).toFixed(2)} km/s`} color={C.green} />
            <Row icon={<RotateCcw  style={{ width: 11, height: 11 }} />} label="Period"    value={position.orbitalPeriodMinutes ? `${position.orbitalPeriodMinutes.toFixed(1)} min` : '—'} />
            <Row icon={<Activity   style={{ width: 11, height: 11 }} />} label="Updated"   value={formatDistanceToNow(new Date(position.timestamp), { addSuffix: true })} color={C.muted} />

            {/* altitude visual bar */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1, color: C.muted }}>ALT PROFILE</span>
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1, color: C.orange }}>{position.altitudeKm.toFixed(0)} km</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,126,53,.1)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${Math.min(100, (position.altitudeKm / 2000) * 100)}%`, background: `linear-gradient(90deg,${C.orange},${C.yellow})`, boxShadow: `0 0 8px ${C.orange}`, borderRadius: 2, transition: 'width 1s ease' }} />
              </div>
            </div>

            {position.lookAngles && (
              <>
                <SectionLabel color={C.yellow}>LOOK ANGLES</SectionLabel>
                <Row icon={<Crosshair style={{ width: 11, height: 11 }} />} label="Azimuth"   value={`${position.lookAngles.azimuthDeg.toFixed(1)}°`}   color={C.yellow} />
                <Row icon={<Navigation style={{ width: 11, height: 11 }} />} label="Elevation" value={`${position.lookAngles.elevationDeg.toFixed(1)}°`} color={C.yellow} />
                <Row icon={<Radio      style={{ width: 11, height: 11 }} />} label="Range"     value={`${position.lookAngles.rangeKm.toFixed(0)} km`}    color={C.yellow} />

                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: overhead ? 'rgba(0,255,136,.06)' : 'rgba(255,126,53,.04)', border: `1px solid ${overhead ? 'rgba(0,255,136,.2)' : 'rgba(255,126,53,.15)'}` }}>
                  {overhead
                    ? <Eye style={{ width: 12, height: 12, color: C.green }} />
                    : <EyeOff style={{ width: 12, height: 12, color: C.muted }} />}
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: 2, color: overhead ? C.green : C.muted }}>
                    {overhead ? 'VISIBLE — ABOVE HORIZON' : 'BELOW HORIZON'}
                  </span>
                </div>
              </>
            )}

            <div style={{ marginTop: 14, paddingTop: 8, borderTop: '1px solid rgba(0,200,255,.06)', fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1, color: 'rgba(0,200,255,.2)', textAlign: 'right' }}>
              {format(new Date(position.timestamp), 'yyyy-MM-dd HH:mm:ss')} UTC
            </div>
          </>
        ) : null}
      </div>

      <style>{`
        @keyframes __shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </div>
  );
}
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Navigation, Gauge, Mountain, Clock, Eye, EyeOff,
  Radio, Star, StarOff, RefreshCw, ExternalLink, Crosshair, RotateCcw, Activity,
} from 'lucide-react';
import type { SatellitePosition, SatelliteSummary } from '../types';
import { useStore } from '../stores/useStore';
import { format, formatDistanceToNow } from 'date-fns';

interface Props {
  satellite?: SatelliteSummary;
  position?: SatellitePosition | null;
  loading?: boolean;
  onRefresh?: () => void;
}

/* ─── Design tokens (must match Layout.tsx) ────────────────────────────── */
const T = {
  bg:         '#0B1120',
  surface:    '#111827',
  border:     'rgba(255,255,255,0.07)',
  borderMid:  'rgba(255,255,255,0.11)',
  accent:     '#3B82F6',
  accentMuted:'rgba(59,130,246,0.12)',
  green:      '#10B981',
  greenMuted: 'rgba(16,185,129,0.10)',
  amber:      '#F59E0B',
  amberMuted: 'rgba(245,158,11,0.10)',
  orange:     '#F97316',
  text:       '#F1F5F9',
  textSub:    '#94A3B8',
  textMuted:  '#475569',
  fontMono:   "'IBM Plex Mono', 'Fira Code', monospace",
  fontSans:   "'IBM Plex Sans', 'Inter', system-ui, sans-serif",
};

/* ─── Sub-components ────────────────────────────────────────────────────── */
function DataRow({
  icon,
  label,
  value,
  valueColor = T.text,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '7px 0',
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: T.textMuted, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{
          fontFamily: T.fontSans,
          fontSize: 12,
          color: T.textSub,
          fontWeight: 500,
        }}>{label}</span>
      </div>
      <span style={{
        fontFamily: T.fontMono,
        fontSize: 12,
        fontWeight: 500,
        color: valueColor,
        letterSpacing: '0.02em',
      }}>{value}</span>
    </div>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 0 6px',
    }}>
      <span style={{
        fontFamily: T.fontSans,
        fontSize: 10,
        fontWeight: 600,
        color: T.textMuted,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{
      height: 32,
      margin: '4px 0',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 3,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: '__shimmer 1.8s ease infinite',
      }} />
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export function SatelliteInfoPanel({ satellite, position, loading, onRefresh }: Props) {
  const { addFavorite, removeFavorite, isFavorite } = useStore();
  const isFav = satellite ? isFavorite(satellite.noradId) : false;
  const toggleFav = () =>
    satellite && (isFav ? removeFavorite(satellite.noradId) : addFavorite(satellite));

  /* Empty state */
  if (!position && !loading) {
    return (
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 180,
        gap: 10,
        borderRadius: 6,
      }}>
        <Crosshair style={{ width: 28, height: 28, color: T.textMuted }} strokeWidth={1.25} />
        <span style={{
          fontFamily: T.fontSans,
          fontSize: 13,
          color: T.textMuted,
          fontWeight: 500,
        }}>
          Select a satellite to view details
        </span>
      </div>
    );
  }

  const overhead = position?.lookAngles?.visible;

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${T.accent}`,
      borderRadius: 6,
      overflow: 'hidden',
    }}>

      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: `1px solid ${T.border}`,
        background: 'rgba(255,255,255,0.015)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Overhead badge */}
            {overhead && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                marginBottom: 6,
                padding: '2px 8px',
                background: T.greenMuted,
                border: `1px solid rgba(16,185,129,0.22)`,
                borderRadius: 3,
              }}>
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: T.green,
                  display: 'inline-block',
                  animation: '__livepulse 2s ease infinite',
                }} />
                <span style={{
                  fontFamily: T.fontSans,
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.green,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  Overhead now
                </span>
              </div>
            )}

            <h2 style={{
              fontFamily: T.fontMono,
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '0.04em',
              color: T.text,
              margin: '0 0 4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {loading
                ? <span style={{ color: T.textMuted }}>Loading…</span>
                : (position?.name || satellite?.name || '—')
              }
            </h2>

            <div style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.textMuted,
              letterSpacing: '0.04em',
            }}>
              NORAD&nbsp;
              <span style={{ color: T.orange, fontWeight: 600 }}>
                {position?.noradId || satellite?.noradId || '—'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
            {satellite && (
              <button
                onClick={toggleFav}
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                style={{
                  background: 'none',
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  padding: 6,
                  color: isFav ? T.amber : T.textMuted,
                  display: 'flex',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {isFav
                  ? <Star style={{ width: 13, height: 13, fill: 'currentColor' }} />
                  : <StarOff style={{ width: 13, height: 13 }} />
                }
              </button>
            )}
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Refresh"
              style={{
                background: 'none',
                border: `1px solid ${T.border}`,
                borderRadius: 4,
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: 6,
                color: loading ? T.textMuted : T.textSub,
                display: 'flex',
                opacity: loading ? 0.5 : 1,
                transition: 'color 0.15s',
              }}
            >
              <RefreshCw style={{
                width: 13,
                height: 13,
                animation: loading ? '__spin 1s linear infinite' : 'none',
              }} />
            </button>
            {satellite && (
              <Link
                to={`/satellites/${satellite.noradId}`}
                title="View details"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 6,
                  color: T.textMuted,
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  transition: 'color 0.15s',
                }}
              >
                <ExternalLink style={{ width: 13, height: 13 }} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Panel body ────────────────────────────────────────────────── */}
      <div style={{ padding: '4px 16px 16px' }}>
        {loading ? (
          <>{[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}</>
        ) : position ? (
          <>
            <SectionHeader>Orbital Position</SectionHeader>

            <DataRow
              icon={<Navigation style={{ width: 11, height: 11 }} />}
              label="Latitude"
              value={`${position.latitudeDeg.toFixed(4)}°`}
            />
            <DataRow
              icon={<Navigation style={{ width: 11, height: 11, transform: 'rotate(90deg)' }} />}
              label="Longitude"
              value={`${position.longitudeDeg.toFixed(4)}°`}
            />
            <DataRow
              icon={<Mountain style={{ width: 11, height: 11 }} />}
              label="Altitude"
              value={`${position.altitudeKm.toFixed(1)} km`}
              valueColor={T.orange}
            />
            <DataRow
              icon={<Gauge style={{ width: 11, height: 11 }} />}
              label="Speed"
              value={`${(position.speedKmPerS ?? 0).toFixed(2)} km/s`}
              valueColor={T.green}
            />
            <DataRow
              icon={<RotateCcw style={{ width: 11, height: 11 }} />}
              label="Period"
              value={position.orbitalPeriodMinutes ? `${position.orbitalPeriodMinutes.toFixed(1)} min` : '—'}
            />
            <DataRow
              icon={<Activity style={{ width: 11, height: 11 }} />}
              label="Updated"
              value={formatDistanceToNow(new Date(position.timestamp), { addSuffix: true })}
              valueColor={T.textSub}
            />

            {/* Altitude bar */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  fontFamily: T.fontSans,
                  fontSize: 11,
                  color: T.textMuted,
                  fontWeight: 500,
                }}>
                  Altitude profile
                </span>
                <span style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  color: T.orange,
                }}>
                  {position.altitudeKm.toFixed(0)} km
                </span>
              </div>
              <div style={{
                height: 4,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 2,
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (position.altitudeKm / 2000) * 100)}%`,
                  background: T.orange,
                  borderRadius: 2,
                  transition: 'width 1s ease',
                  opacity: 0.85,
                }} />
              </div>
            </div>

            {/* Look angles */}
            {position.lookAngles && (
              <>
                <SectionHeader>Look Angles</SectionHeader>
                <DataRow
                  icon={<Crosshair style={{ width: 11, height: 11 }} />}
                  label="Azimuth"
                  value={`${position.lookAngles.azimuthDeg.toFixed(1)}°`}
                  valueColor={T.amber}
                />
                <DataRow
                  icon={<Navigation style={{ width: 11, height: 11 }} />}
                  label="Elevation"
                  value={`${position.lookAngles.elevationDeg.toFixed(1)}°`}
                  valueColor={T.amber}
                />
                <DataRow
                  icon={<Radio style={{ width: 11, height: 11 }} />}
                  label="Range"
                  value={`${position.lookAngles.rangeKm.toFixed(0)} km`}
                  valueColor={T.amber}
                />

                {/* Visibility status */}
                <div style={{
                  marginTop: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: overhead ? T.greenMuted : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${overhead ? 'rgba(16,185,129,0.2)' : T.border}`,
                  borderRadius: 4,
                }}>
                  {overhead
                    ? <Eye style={{ width: 12, height: 12, color: T.green }} />
                    : <EyeOff style={{ width: 12, height: 12, color: T.textMuted }} />
                  }
                  <span style={{
                    fontFamily: T.fontSans,
                    fontSize: 12,
                    fontWeight: 500,
                    color: overhead ? T.green : T.textMuted,
                  }}>
                    {overhead ? 'Visible — above horizon' : 'Below horizon'}
                  </span>
                </div>
              </>
            )}

            {/* Timestamp */}
            <div style={{
              marginTop: 14,
              paddingTop: 10,
              borderTop: `1px solid ${T.border}`,
              fontFamily: T.fontMono,
              fontSize: 10,
              color: T.textMuted,
              textAlign: 'right',
              letterSpacing: '0.03em',
            }}>
              {format(new Date(position.timestamp), 'yyyy-MM-dd HH:mm:ss')} UTC
            </div>
          </>
        ) : null}
      </div>

      <style>{`
        @keyframes __spin       { to{transform:rotate(360deg)} }
        @keyframes __livepulse  { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes __shimmer    { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      `}</style>
    </div>
  );
}
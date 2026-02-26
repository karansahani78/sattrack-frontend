import { useState, useEffect } from 'react';
import { AlertTriangle, ChevronRight, Activity } from 'lucide-react';
import { useConjunctions } from '../hooks';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

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

const RISK_CONFIG = {
  LOW:      { color: '#39ff14', bg: 'rgba(57,255,20,.06)',   border: 'rgba(57,255,20,.2)',   label: 'LOW',      icon: '●' },
  MEDIUM:   { color: '#ffd060', bg: 'rgba(255,208,96,.06)',  border: 'rgba(255,208,96,.2)',  label: 'MEDIUM',   icon: '◆' },
  HIGH:     { color: '#ff7e35', bg: 'rgba(255,126,53,.06)',  border: 'rgba(255,126,53,.25)', label: 'HIGH',     icon: '▲' },
  CRITICAL: { color: '#ff3344', bg: 'rgba(255,51,68,.08)',   border: 'rgba(255,51,68,.35)',  label: 'CRITICAL', icon: '⚠' },
};

export function Conjunctions() {
  const [page, setPage] = useState(0);
  const { data, loading, error, liveAlert } = useConjunctions(page, 15);
  const [newAlertFlash, setNewAlertFlash] = useState(false);

  // ✅ FIX: was useState(() => {...}) which does nothing — must be useEffect
  useEffect(() => {
    if (liveAlert) {
      setNewAlertFlash(true);
      const t = setTimeout(() => setNewAlertFlash(false), 5000);
      return () => clearTimeout(t);
    }
  }, [liveAlert]);

  const totalCritical = data?.content.filter(c => c.riskLevel === 'CRITICAL').length ?? 0;
  const totalHigh     = data?.content.filter(c => c.riskLevel === 'HIGH').length ?? 0;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <AlertTriangle style={{ width: 22, height: 22, color: C.orange, filter: `drop-shadow(0 0 6px ${C.orange})` }} />
          <h1 style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, fontWeight: 900, letterSpacing: 4, color: '#fff', textShadow: '0 0 20px rgba(255,126,53,.4)', margin: 0 }}>
            CONJUNCTION <span style={{ color: C.orange }}>ALERTS</span>
          </h1>
        </div>
        <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: C.muted, letterSpacing: 1, margin: 0 }}>
          Close-approach predictions within 24 hr lookahead window · Screened every orbit
        </p>
      </div>

      {/* Live alert flash banner */}
      {newAlertFlash && (
        <div style={{
          marginBottom: 16, padding: '10px 16px',
          background: 'rgba(255,51,68,.1)', border: '1px solid rgba(255,51,68,.4)',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: '__fadeIn 0.3s ease',
          fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 2, color: C.red,
        }}>
          <span style={{ animation: '__blink 0.8s infinite' }}>⚠</span>
          NEW CONJUNCTION ALERT RECEIVED — LIST UPDATED
        </div>
      )}

      {/* Summary stats */}
      {data && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'TOTAL EVENTS',    value: data.totalElements, color: C.cyan   },
            { label: 'CRITICAL',        value: totalCritical,      color: C.red    },
            { label: 'HIGH RISK',       value: totalHigh,          color: C.orange },
            { label: 'SHOWING PAGE',    value: `${page + 1} / ${data.totalPages}`, color: C.muted },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '8px 16px', background: C.surface, border: `1px solid ${C.border}`, flex: '1 0 auto' }}>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, fontWeight: 900, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Risk level legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(RISK_CONFIG).map(([key, cfg]) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1, color: cfg.color,
          }}>
            <span>{cfg.icon}</span> {cfg.label} ({key === 'CRITICAL' ? '< 0.2 km' : key === 'HIGH' ? '0.2–1 km' : key === 'MEDIUM' ? '1–5 km' : '> 5 km'})
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,51,68,.08)', border: '1px solid rgba(255,51,68,.3)', color: C.red, fontFamily: "'Share Tech Mono',monospace", fontSize: 11, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 70, background: 'rgba(0,200,255,.03)', animation: '__shimmer 1.8s infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data?.content.map((conj, i) => {
            const cfg = RISK_CONFIG[conj.riskLevel as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.LOW;
            const tcaDate = new Date(conj.tca);
            const isPast  = tcaDate < new Date();
            return (
              <div key={i} style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderLeft: `3px solid ${cfg.color}`,
                padding: '12px 16px',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr 1fr 1fr auto',
                alignItems: 'center',
                gap: 16,
              }}>
                {/* Risk badge */}
                <div style={{
                  padding: '4px 10px', background: `${cfg.color}15`,
                  border: `1px solid ${cfg.color}44`,
                  fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 2,
                  color: cfg.color, textAlign: 'center', minWidth: 72,
                  boxShadow: `0 0 12px ${cfg.color}22`,
                }}>
                  {cfg.icon} {cfg.label}
                </div>

                {/* Satellites */}
                <div>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>OBJECTS</div>
                  <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, color: '#e2f0ff', letterSpacing: 1 }}>
                    {conj.satelliteNameA}
                  </div>
                  <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, color: cfg.color, letterSpacing: 1 }}>
                    {conj.satelliteNameB}
                  </div>
                </div>

                {/* TCA */}
                <div>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>TIME OF CLOSEST APPROACH</div>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 12, color: '#e2f0ff', letterSpacing: 1 }}>
                    {format(tcaDate, 'MMM dd HH:mm:ss')} UTC
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: isPast ? C.muted : cfg.color, marginTop: 1 }}>
                    {isPast ? 'passed' : formatDistanceToNow(tcaDate, { addSuffix: true })}
                  </div>
                </div>

                {/* Miss distance + speed */}
                <div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1 }}>MISS DISTANCE</div>
                    <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 16, fontWeight: 900, color: cfg.color, lineHeight: 1.1 }}>
                      {conj.missDistanceKm.toFixed(3)} <span style={{ fontSize: 9 }}>km</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1 }}>REL SPEED</div>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: '#e2f0ff' }}>
                      {conj.relativeSpeedKms.toFixed(2)} km/s
                    </div>
                  </div>
                </div>

                {/* Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Link to={`/satellites/${conj.noradIdA}`} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', background: 'rgba(0,200,255,.06)', border: `1px solid ${C.border}`,
                    color: C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 1,
                  }}>
                    {conj.noradIdA} <ChevronRight style={{ width: 9, height: 9 }} />
                  </Link>
                  <Link to={`/satellites/${conj.noradIdB}`} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', background: 'rgba(0,200,255,.06)', border: `1px solid ${C.border}`,
                    color: C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 1,
                  }}>
                    {conj.noradIdB} <ChevronRight style={{ width: 9, height: 9 }} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '6px 16px', background: 'rgba(0,200,255,.06)', border: `1px solid ${C.border}`,
              color: page === 0 ? C.muted : C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
              cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1, letterSpacing: 1,
            }}
          >
            ← PREV
          </button>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: 1 }}>
            PAGE {page + 1} / {data.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
            disabled={page >= data.totalPages - 1}
            style={{
              padding: '6px 16px', background: 'rgba(0,200,255,.06)', border: `1px solid ${C.border}`,
              color: page >= data.totalPages - 1 ? C.muted : C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
              cursor: page >= data.totalPages - 1 ? 'default' : 'pointer', opacity: page >= data.totalPages - 1 ? 0.4 : 1, letterSpacing: 1,
            }}
          >
            NEXT →
          </button>
        </div>
      )}

      {!loading && data?.content.length === 0 && (
        <div style={{ textAlign: 'center', color: C.muted, fontFamily: "'Share Tech Mono',monospace", fontSize: 12, padding: 60, opacity: 0.6 }}>
          <Activity style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          No active conjunction alerts in lookahead window
        </div>
      )}

      <style>{`
        @keyframes __shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes __fadeIn  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes __blink   { 0%,100%{opacity:1} 50%{opacity:.15} }
      `}</style>
    </div>
  );
}
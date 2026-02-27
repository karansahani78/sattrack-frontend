import { useState, useEffect } from 'react';
import { AlertTriangle, ChevronRight, Activity } from 'lucide-react';
import { useConjunctions } from '../hooks';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

const C = {
  primary: '#2f6fed',
  danger: '#d64545',
  warning: '#e39d2d',
  success: '#2e8b57',
  text: '#e8eefc',
  muted: '#8fa2c7',
  border: '#1e2a44',
  surface: '#0f172a',
  surfaceSoft: '#111c33',
};

const RISK_CONFIG = {
  LOW:      { color: C.success,  label: 'LOW' },
  MEDIUM:   { color: C.warning,  label: 'MEDIUM' },
  HIGH:     { color: '#c96a28',  label: 'HIGH' },
  CRITICAL: { color: C.danger,   label: 'CRITICAL' },
};

export function Conjunctions() {
  const [page, setPage] = useState(0);
  const { data, loading, error, liveAlert } = useConjunctions(page, 15);
  const [newAlertFlash, setNewAlertFlash] = useState(false);

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
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', color: C.text }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={20} color={C.warning} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Conjunction Risk Monitoring
          </h1>
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
          Predicted close approaches within 24-hour screening window · Automated orbital propagation
        </p>
      </div>

      {/* Live Alert Banner */}
      {newAlertFlash && (
        <div style={{
          marginBottom: 18,
          padding: '12px 16px',
          background: 'rgba(214,69,69,0.08)',
          border: `1px solid ${C.danger}`,
          borderRadius: 6,
          fontSize: 13,
        }}>
          New conjunction event detected — list updated.
        </div>
      )}

      {/* Summary Stats */}
      {data && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Events', value: data.totalElements },
            { label: 'Critical', value: totalCritical },
            { label: 'High Risk', value: totalHigh },
            { label: 'Page', value: `${page + 1} / ${data.totalPages}` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: C.surfaceSoft,
              border: `1px solid ${C.border}`,
              padding: '14px 18px',
              borderRadius: 6,
              minWidth: 160,
            }}>
              <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(214,69,69,0.08)',
          border: `1px solid ${C.danger}`,
          borderRadius: 6,
          marginBottom: 18,
        }}>
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
          <Activity size={32} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data?.content.map((conj, i) => {
            const cfg = RISK_CONFIG[conj.riskLevel as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.LOW;
            const tcaDate = new Date(conj.tca);
            const isPast  = tcaDate < new Date();

            return (
              <div key={i} style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '18px 20px',
                display: 'grid',
                gridTemplateColumns: '140px 1fr 1fr 160px',
                gap: 20,
                alignItems: 'center',
              }}>

                {/* Risk */}
                <div style={{
                  background: `${cfg.color}15`,
                  color: cfg.color,
                  border: `1px solid ${cfg.color}40`,
                  padding: '6px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center'
                }}>
                  {cfg.label}
                </div>

                {/* Satellites */}
                <div>
                  <div style={{ fontSize: 12, color: C.muted }}>Objects</div>
                  <div style={{ fontWeight: 600 }}>{conj.satelliteNameA}</div>
                  <div style={{ fontWeight: 600, color: cfg.color }}>{conj.satelliteNameB}</div>
                </div>

                {/* TCA */}
                <div>
                  <div style={{ fontSize: 12, color: C.muted }}>Time of Closest Approach</div>
                  <div style={{ fontSize: 14 }}>
                    {format(tcaDate, 'MMM dd HH:mm:ss')} UTC
                  </div>
                  <div style={{ fontSize: 12, color: isPast ? C.muted : cfg.color }}>
                    {isPast ? 'Event passed' : formatDistanceToNow(tcaDate, { addSuffix: true })}
                  </div>
                </div>

                {/* Distance + Links */}
                <div>
                  <div style={{ fontSize: 12, color: C.muted }}>Miss Distance</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>
                    {conj.missDistanceKm.toFixed(3)} km
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    Rel Speed: {conj.relativeSpeedKms.toFixed(2)} km/s
                  </div>

                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <Link to={`/satellites/${conj.noradIdA}`} style={{ fontSize: 12, color: C.primary }}>
                      {conj.noradIdA} <ChevronRight size={12} />
                    </Link>
                    <Link to={`/satellites/${conj.noradIdB}`} style={{ fontSize: 12, color: C.primary }}>
                      {conj.noradIdB} <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 28 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '8px 18px',
              background: C.surfaceSoft,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              cursor: page === 0 ? 'default' : 'pointer',
              opacity: page === 0 ? 0.4 : 1,
            }}
          >
            Previous
          </button>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
            disabled={page >= data.totalPages - 1}
            style={{
              padding: '8px 18px',
              background: C.surfaceSoft,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              cursor: page >= data.totalPages - 1 ? 'default' : 'pointer',
              opacity: page >= data.totalPages - 1 ? 0.4 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}

      {!loading && data?.content.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
          No active conjunction events in the 24-hour screening window.
        </div>
      )}
    </div>
  );
}
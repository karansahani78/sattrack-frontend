import { useState } from 'react';
import { Bell, BellOff, Check, CheckCheck, AlertTriangle, Radio, Satellite, Star, Trash2, Plus } from 'lucide-react';
import { useNotifications, useAlerts } from '../hooks';
import { format, formatDistanceToNow } from 'date-fns';
import type { AlertPreferenceRequest, AlertType } from '../types';

const C = {
  cyan:    '#00d4ff',
  green:   '#39ff14',
  orange:  '#ff7e35',
  yellow:  '#ffd060',
  red:     '#ff3344',
  purple:  '#c084fc',
  muted:   'rgba(140,180,210,.55)',
  border:  'rgba(0,200,255,.12)',
  surface: 'rgba(5,12,35,.9)',
};

const NOTIF_ICONS: Record<string, JSX.Element> = {
  PASS_UPCOMING:        <Radio style={{ width: 14, height: 14 }} />,
  PASS_NOW:             <Radio style={{ width: 14, height: 14 }} />,
  CONJUNCTION_WARNING:  <AlertTriangle style={{ width: 14, height: 14 }} />,
  CONJUNCTION_CRITICAL: <AlertTriangle style={{ width: 14, height: 14 }} />,
  TLE_STALE:            <Satellite style={{ width: 14, height: 14 }} />,
  REENTRY_WARNING:      <AlertTriangle style={{ width: 14, height: 14 }} />,
  SYSTEM:               <Bell style={{ width: 14, height: 14 }} />,
};

const NOTIF_COLORS: Record<string, string> = {
  PASS_UPCOMING:        C.cyan,
  PASS_NOW:             C.green,
  CONJUNCTION_WARNING:  C.orange,
  CONJUNCTION_CRITICAL: C.red,
  TLE_STALE:            C.yellow,
  REENTRY_WARNING:      C.red,
  SYSTEM:               C.muted,
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  PASS_OVERHEAD:   'Satellite Pass Overhead',
  CONJUNCTION:     'Conjunction / Close Approach',
  TLE_STALE:       'TLE Data Stale',
  REENTRY_WARNING: 'Re-entry Warning',
};

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? C.cyan : 'transparent'}`,
      color: active ? C.cyan : C.muted,
      fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: 2, cursor: 'pointer',
      transition: 'all 0.2s',
    }}>
      {label}
    </button>
  );
}

export function Notifications() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'alerts'>('inbox');
  const [notifPage, setNotifPage] = useState(0);

  const { data, loading: nLoading, error: nError, markRead, markAllRead } = useNotifications(notifPage, 25);
  const { alerts, loading: aLoading, error: aError, createAlert, deleteAlert } = useAlerts();

  // New alert form
  const [showForm, setShowForm] = useState(false);
  const [formNoradId, setFormNoradId] = useState('');
  const [formType, setFormType] = useState<AlertType>('PASS_OVERHEAD');
  const [formMinEl, setFormMinEl] = useState(10);
  const [formVisible, setFormVisible] = useState(false);
  const [formLead, setFormLead] = useState(10);
  const [formLoading, setFormLoading] = useState(false);

  const submitAlert = async () => {
    setFormLoading(true);
    try {
      const req: AlertPreferenceRequest = {
        noradId: formNoradId || undefined,
        alertType: formType,
        minElevation: formType === 'PASS_OVERHEAD' ? formMinEl : undefined,
        visibleOnly: formVisible,
        leadTimeMinutes: formLead,
      };
      await createAlert(req);
      setShowForm(false);
      setFormNoradId('');
    } catch {
      alert('Failed to create alert');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <Bell style={{ width: 22, height: 22, color: C.yellow, filter: `drop-shadow(0 0 6px ${C.yellow})` }} />
          <h1 style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, fontWeight: 900, letterSpacing: 4, color: '#fff', textShadow: '0 0 20px rgba(255,208,96,.3)', margin: 0 }}>
            NOTIFI<span style={{ color: C.yellow }}>CATIONS</span>
          </h1>
        </div>
        <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: C.muted, letterSpacing: 1, margin: 0 }}>
          Pass alerts, conjunction warnings, and system messages
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        <Tab label="INBOX" active={activeTab === 'inbox'} onClick={() => setActiveTab('inbox')} />
        <Tab label="ALERT PREFERENCES" active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} />
        {data && data.unreadCount > 0 && activeTab === 'inbox' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: C.yellow, letterSpacing: 1 }}>
              {data.unreadCount} unread
            </span>
            <button
              onClick={markAllRead}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px',
                background: 'rgba(0,200,255,.06)', border: `1px solid ${C.border}`,
                color: C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1,
                cursor: 'pointer',
              }}
            >
              <CheckCheck style={{ width: 11, height: 11 }} /> MARK ALL READ
            </button>
          </div>
        )}
      </div>

      {/* ── INBOX TAB ── */}
      {activeTab === 'inbox' && (
        <>
          {nError && (
            <div style={{ padding: '10px 14px', background: 'rgba(255,51,68,.08)', border: '1px solid rgba(255,51,68,.3)', color: C.red, fontFamily: "'Share Tech Mono',monospace", fontSize: 11, marginBottom: 12 }}>
              {nError}
            </div>
          )}

          {nLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 68, background: 'rgba(0,200,255,.03)', animation: '__shimmer 1.8s infinite' }} />
              ))}
            </div>
          ) : (
            <>
              {!data?.notifications.length ? (
                <div style={{ textAlign: 'center', color: C.muted, fontFamily: "'Share Tech Mono',monospace", fontSize: 12, padding: 60, opacity: 0.5 }}>
                  <BellOff style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                  No notifications yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {data.notifications.map(n => {
                    const color = NOTIF_COLORS[n.notificationType] ?? C.muted;
                    const icon  = NOTIF_ICONS[n.notificationType];
                    return (
                      <div
                        key={n.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '12px 14px',
                          background: n.read ? 'rgba(0,200,255,.02)' : `rgba(${color === C.red ? '255,51,68' : '0,200,255'},.05)`,
                          border: `1px solid ${n.read ? C.border : color + '33'}`,
                          borderLeft: `3px solid ${n.read ? 'transparent' : color}`,
                          opacity: n.read ? 0.65 : 1,
                          transition: 'all 0.2s',
                          cursor: n.read ? 'default' : 'pointer',
                        }}
                        onClick={() => !n.read && markRead(n.id)}
                      >
                        {/* Icon */}
                        <div style={{ color, flexShrink: 0, marginTop: 2 }}>{icon}</div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 12, color: n.read ? C.muted : '#e2f0ff', letterSpacing: 0.5, fontWeight: n.read ? 'normal' : 'bold' }}>
                              {n.title}
                            </div>
                            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {formatDistanceToNow(new Date(n.sentAt), { addSuffix: true })}
                            </div>
                          </div>
                          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: 0.5, marginTop: 3, lineHeight: 1.5 }}>
                            {n.message}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                            <span style={{ padding: '1px 6px', background: color + '15', border: `1px solid ${color}33`, color, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 1 }}>
                              {n.notificationType.replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: C.muted, letterSpacing: 0.5 }}>
                              {format(new Date(n.sentAt), 'yyyy-MM-dd HH:mm:ss')} UTC
                            </span>
                            {!n.read && (
                              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 1 }}>
                                <Check style={{ width: 9, height: 9 }} /> click to mark read
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                  <button onClick={() => setNotifPage(p => Math.max(0, p - 1))} disabled={notifPage === 0} style={{
                    padding: '5px 14px', background: 'rgba(0,200,255,.06)', border: `1px solid ${C.border}`,
                    color: notifPage === 0 ? C.muted : C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
                    cursor: notifPage === 0 ? 'default' : 'pointer', opacity: notifPage === 0 ? 0.4 : 1,
                  }}>← PREV</button>
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: C.muted }}>
                    {notifPage + 1} / {data.totalPages}
                  </span>
                  <button onClick={() => setNotifPage(p => Math.min(data.totalPages - 1, p + 1))} disabled={notifPage >= data.totalPages - 1} style={{
                    padding: '5px 14px', background: 'rgba(0,200,255,.06)', border: `1px solid ${C.border}`,
                    color: notifPage >= data.totalPages - 1 ? C.muted : C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
                    cursor: notifPage >= data.totalPages - 1 ? 'default' : 'pointer', opacity: notifPage >= data.totalPages - 1 ? 0.4 : 1,
                  }}>NEXT →</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── ALERT PREFERENCES TAB ── */}
      {activeTab === 'alerts' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: C.muted, letterSpacing: 1 }}>
              {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
            </span>
            <button onClick={() => setShowForm(!showForm)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: showForm ? 'rgba(0,200,255,.12)' : 'rgba(0,200,255,.06)',
              border: `1px solid ${showForm ? C.cyan : C.border}`,
              color: C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: 2, cursor: 'pointer',
            }}>
              <Plus style={{ width: 12, height: 12 }} /> NEW ALERT
            </button>
          </div>

          {/* Create alert form */}
          {showForm && (
            <div style={{
              marginBottom: 16, padding: 16,
              background: 'rgba(0,200,255,.04)', border: `1px solid ${C.cyan}33`,
              borderLeft: `3px solid ${C.cyan}`,
            }}>
              <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 3, color: C.cyan, marginBottom: 14 }}>
                CREATE ALERT PREFERENCE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>ALERT TYPE</div>
                  <select value={formType} onChange={e => setFormType(e.target.value as AlertType)} style={{
                    width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
                    padding: '6px 8px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace", fontSize: 11, outline: 'none',
                  }}>
                    {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map(k => (
                      <option key={k} value={k}>{ALERT_TYPE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>
                    NORAD ID <span style={{ opacity: 0.5 }}>(blank = all sats)</span>
                  </div>
                  <input value={formNoradId} onChange={e => setFormNoradId(e.target.value)} placeholder="e.g. 25544" style={{
                    width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
                    padding: '6px 10px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace", fontSize: 12, outline: 'none',
                  }} />
                </div>
                {formType === 'PASS_OVERHEAD' && (
                  <>
                    <div>
                      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>MIN ELEVATION (°)</div>
                      <input type="number" value={formMinEl} onChange={e => setFormMinEl(Number(e.target.value))} style={{
                        width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
                        padding: '6px 10px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace", fontSize: 12, outline: 'none',
                      }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>LEAD TIME (MINUTES)</div>
                      <input type="number" value={formLead} onChange={e => setFormLead(Number(e.target.value))} style={{
                        width: '100%', background: 'rgba(0,200,255,.05)', border: `1px solid ${C.border}`,
                        padding: '6px 10px', color: '#e2f0ff', fontFamily: "'Share Tech Mono',monospace", fontSize: 12, outline: 'none',
                      }} />
                    </div>
                  </>
                )}
              </div>
              {formType === 'PASS_OVERHEAD' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                  <input type="checkbox" checked={formVisible} onChange={e => setFormVisible(e.target.checked)} style={{ accentColor: C.cyan }} />
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: 1 }}>VISIBLE PASSES ONLY</span>
                </label>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitAlert} disabled={formLoading} style={{
                  padding: '7px 20px', background: 'rgba(0,200,255,.1)', border: `1px solid ${C.cyan}`,
                  color: C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: 2, cursor: 'pointer',
                  opacity: formLoading ? 0.6 : 1,
                }}>
                  {formLoading ? 'SAVING...' : 'SAVE ALERT'}
                </button>
                <button onClick={() => setShowForm(false)} style={{
                  padding: '7px 16px', background: 'rgba(0,200,255,.04)', border: `1px solid ${C.border}`,
                  color: C.muted, fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: 1, cursor: 'pointer',
                }}>
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {aError && (
            <div style={{ padding: '10px 14px', background: 'rgba(255,51,68,.08)', border: '1px solid rgba(255,51,68,.3)', color: C.red, fontFamily: "'Share Tech Mono',monospace", fontSize: 11, marginBottom: 12 }}>
              {aError}
            </div>
          )}

          {aLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 60, background: 'rgba(0,200,255,.03)', marginBottom: 4 }} />
            ))
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.muted, fontFamily: "'Share Tech Mono',monospace", fontSize: 12, padding: 40, opacity: 0.5 }}>
              <Bell style={{ width: 40, height: 40, margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
              No alert preferences configured
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {alerts.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${a.active ? C.cyan : C.muted}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: '#e2f0ff', letterSpacing: 0.5 }}>
                        {ALERT_TYPE_LABELS[a.alertType]}
                      </span>
                      {a.satelliteName && (
                        <span style={{ padding: '1px 6px', background: 'rgba(0,200,255,.08)', border: `1px solid ${C.border}`, color: C.cyan, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 1 }}>
                          {a.satelliteName}
                        </span>
                      )}
                      <span style={{ padding: '1px 6px', background: a.active ? 'rgba(57,255,20,.08)' : 'rgba(140,180,210,.04)', border: `1px solid ${a.active ? 'rgba(57,255,20,.25)' : C.border}`, color: a.active ? C.green : C.muted, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 1 }}>
                        {a.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: 0.5 }}>
                      {a.minElevation != null && <span>MIN EL: {a.minElevation}°</span>}
                      <span>LEAD: {a.leadTimeMinutes} min</span>
                      {a.visibleOnly && <span style={{ color: C.green }}>VISIBLE ONLY</span>}
                      {a.lastTriggeredAt && <span>LAST: {formatDistanceToNow(new Date(a.lastTriggeredAt), { addSuffix: true })}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteAlert(a.id)}
                    title="Delete alert"
                    style={{ background: 'none', border: '1px solid rgba(255,51,68,.2)', padding: '5px 8px', cursor: 'pointer', color: 'rgba(255,51,68,.5)', display: 'flex', transition: 'all .2s' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = C.red)}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,51,68,.5)')}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes __shimmer { 0%{opacity:.5} 50%{opacity:1} 100%{opacity:.5} }
      `}</style>
    </div>
  );
}
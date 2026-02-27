import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Satellite, List, LogIn, LogOut, User, Globe, Menu, X, Bell, Radio, AlertTriangle, Activity } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../stores/useStore';
import { useUtcClock, useUnreadCount } from '../hooks';

function injectGlobalStyles() {
  if (document.getElementById('__sattrack_global')) return;
  const el = document.createElement('style');
  el.id = '__sattrack_global';
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;600;900&display=swap');
    html, body, #root { background:#030712!important; color:#e2f0ff; font-family:'Share Tech Mono',monospace; margin:0; padding:0; }
    *{box-sizing:border-box}
    ::-webkit-scrollbar{width:3px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#00c8ff44;border-radius:2px}
    a{text-decoration:none;color:inherit}
    @keyframes __blink{0%,100%{opacity:1}50%{opacity:.2}}
    @keyframes __spin{to{transform:rotate(360deg)}}
    @keyframes __ticker{from{transform:translateX(100%)}to{transform:translateX(-100%)}}
    @keyframes __fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
    @keyframes __glow{0%,100%{box-shadow:0 0 6px #00ff88}50%{box-shadow:0 0 16px #00ff88,0 0 32px #00ff8844}}
    @keyframes __bellShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-12deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(8deg)}}
    .nav-link {
      display: flex; align-items: center; gap: 6px;
      padding: 0 11px; height: 60px;
      font-family: 'Share Tech Mono', monospace; font-size: 10px; letter-spacing: 2px;
      transition: all .2s; white-space: nowrap;
      border-bottom: 2px solid transparent;
      text-decoration: none;
    }
    .nav-link:hover { color: #00c8ff !important; background: rgba(0,200,255,.04); }
    @media(max-width:1200px) {
      .nav-label { display: none !important; }
      .nav-link  { padding: 0 10px; }
    }
    @media(max-width:820px) {
      .nav-desktop { display: none !important; }
      .__mob       { display: flex !important; }
    }
  `;
  document.head.appendChild(el);
}

function NotificationBell() {
  const unread = useUnreadCount();
  const navigate = useNavigate();
  const [shake, setShake] = useState(false);
  const prevUnread = useRef(0);

  useEffect(() => {
    if (unread > prevUnread.current) {
      setShake(true);
      setTimeout(() => setShake(false), 700);
    }
    prevUnread.current = unread;
  }, [unread]);

  return (
    <button
      onClick={() => navigate('/notifications')}
      title={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 38, height: 60, background: 'none', border: 'none', cursor: 'pointer',
        color: unread > 0 ? '#ffd060' : 'rgba(150,190,220,.5)', padding: 0, flexShrink: 0,
      }}
    >
      <Bell style={{ width: 15, height: 15, animation: shake ? '__bellShake 0.6s ease' : 'none' }} />
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: 12, right: 3,
          minWidth: 16, height: 16, borderRadius: 8,
          background: '#ff3344', border: '1.5px solid #030712',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Orbitron',monospace", fontSize: 8, fontWeight: 700,
          color: '#fff', padding: '0 3px',
          boxShadow: '0 0 8px rgba(255,51,68,.7)', animation: '__blink 2s infinite',
        }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user, clearAuth } = useStore();
  const [open, setOpen] = useState(false);
  const now = useUtcClock();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { injectGlobalStyles(); }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    c.width = window.innerWidth;
    c.height = 60;
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height;
      const r = Math.random() * .9 + .1;
      const a = Math.random() * .6 + .1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160,210,255,${a})`;
      ctx.fill();
    }
  }, []);

  const utc = now.toISOString().replace('T', ' ').split('.')[0] + ' UTC';

  const navLinks = [
    { to: '/',             label: 'DASHBOARD',    icon: Globe         },
    { to: '/satellites',   label: 'SATELLITES',   icon: List          },
    { to: '/passes',       label: 'PASSES',       icon: Radio         },
    { to: '/conjunctions', label: 'CONJUNCTIONS', icon: AlertTriangle },
    { to: '/doppler',      label: 'DOPPLER',      icon: Activity      },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#030712' }}>

      <header style={{ position: 'sticky', top: 0, zIndex: 500, height: 60 }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .35, pointerEvents: 'none' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,7,18,.94)', backdropFilter: 'blur(24px)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,#00c8ff 25%,#00c8ff 75%,transparent)', opacity: .6 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'rgba(0,200,255,.1)' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>

          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Satellite style={{ width: 22, height: 22, color: '#00c8ff', filter: 'drop-shadow(0 0 8px #00c8ff)' }} strokeWidth={1.5} />
              <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: '#00ff88', border: '1.5px solid #030712', animation: '__blink 2s infinite,__glow 2s infinite', display: 'block' }} />
            </div>
            <span style={{ fontFamily: "'Orbitron',monospace", fontWeight: 900, fontSize: 16, letterSpacing: 4, color: '#fff', textShadow: '0 0 20px rgba(0,200,255,.5)', whiteSpace: 'nowrap' }}>
              SAT<span style={{ color: '#00c8ff' }}>TRACK</span>
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 14px', background: 'rgba(0,200,255,.04)', border: '1px solid rgba(0,200,255,.12)', flexShrink: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', display: 'inline-block', animation: '__blink 1s infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, letterSpacing: 1.5, color: '#00c8ff', textShadow: '0 0 10px rgba(0,200,255,.7)', whiteSpace: 'nowrap' }}>{utc}</span>
          </div>

          <div style={{ flex: 1 }} />

          <nav className="nav-desktop" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {navLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
              return (
                <Link key={to} to={to} className="nav-link" style={{
                  color:        active ? '#00c8ff' : 'rgba(150,190,220,.55)',
                  background:   active ? 'rgba(0,200,255,.06)' : 'transparent',
                  borderBottom: `2px solid ${active ? '#00c8ff' : 'transparent'}`,
                }}>
                  <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
                  <span className="nav-label">{label}</span>
                </Link>
              );
            })}

            <div style={{ width: 1, height: 26, background: 'rgba(0,200,255,.15)', margin: '0 4px', flexShrink: 0 }} />

            {token ? (
              <>
                <NotificationBell />
                <Link to="/profile" className="nav-link" style={{ color: 'rgba(150,190,220,.5)' }}>
                  <User style={{ width: 13, height: 13, flexShrink: 0 }} />
                  <span className="nav-label">{user?.username?.toUpperCase()}</span>
                </Link>
                <button
                  onClick={() => { clearAuth(); navigate('/'); }}
                  style={{ display: 'flex', alignItems: 'center', padding: '0 10px', height: 60,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,80,60,.55)', flexShrink: 0 }}>
                  <LogOut style={{ width: 13, height: 13 }} />
                </button>
              </>
            ) : (
              <Link to="/login" className="nav-link" style={{
                color: 'rgba(150,190,220,.5)', borderLeft: '1px solid rgba(0,200,255,.1)', paddingLeft: 14,
              }}>
                <LogIn style={{ width: 13, height: 13, flexShrink: 0 }} />
                <span className="nav-label">SIGN IN</span>
              </Link>
            )}
          </nav>

          <button onClick={() => setOpen(!open)} className="__mob"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 4px', height: 60, color: '#00c8ff', flexShrink: 0 }}>
            {open ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
          </button>
        </div>

        {open && (
          <div style={{ position: 'absolute', top: 60, left: 0, right: 0, zIndex: 2,
            background: 'rgba(3,7,18,.98)', borderBottom: '1px solid rgba(0,200,255,.1)',
            padding: '8px 24px 16px', animation: '__fadeIn .15s ease' }}>
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} onClick={() => setOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
                  color: '#00c8ff', fontFamily: "'Share Tech Mono',monospace", fontSize: 12,
                  letterSpacing: 2, borderBottom: '1px solid rgba(0,200,255,.06)' }}>
                <Icon style={{ width: 14, height: 14 }} />{label}
              </Link>
            ))}
            {token && (
              <Link to="/notifications" onClick={() => setOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
                  color: '#ffd060', fontFamily: "'Share Tech Mono',monospace", fontSize: 12,
                  letterSpacing: 2, borderBottom: '1px solid rgba(0,200,255,.06)' }}>
                <Bell style={{ width: 14, height: 14 }} />NOTIFICATIONS
              </Link>
            )}
            {token && (
              <button onClick={() => { clearAuth(); navigate('/'); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,80,60,.7)', fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 12, letterSpacing: 2 }}>
                <LogOut style={{ width: 14, height: 14 }} />SIGN OUT
              </button>
            )}
            {!token && (
              <Link to="/login" onClick={() => setOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
                  color: 'rgba(150,190,220,.7)', fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 12, letterSpacing: 2 }}>
                <LogIn style={{ width: 14, height: 14 }} />SIGN IN
              </Link>
            )}
          </div>
        )}
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer style={{ height: 34, borderTop: '1px solid rgba(0,200,255,.06)', background: 'rgba(3,7,18,.95)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, overflow: 'hidden' }}>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2,
          color: 'rgba(0,200,255,.2)', whiteSpace: 'nowrap' }}>SGP4 · WGS-84</span>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ animation: '__ticker 50s linear infinite', whiteSpace: 'nowrap',
            fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1.5,
            color: 'rgba(0,200,255,.15)' }}>
            {'ISS (ZARYA) · HUBBLE · CSS TIANHE · NOAA-19 · STARLINK · ONEWEB · GPS BLOCK III · GALILEO · BEIDOU · GLONASS · SENTINEL-6 · LANDSAT-9 · JAMES WEBB · AQUA · TERRA ·  '}
          </div>
        </div>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2,
          color: 'rgba(0,200,255,.2)', whiteSpace: 'nowrap' }}>CELESTRAK</span>
      </footer>

    </div>
  );
}
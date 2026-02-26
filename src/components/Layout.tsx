import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Satellite, List, LogIn, LogOut, User, Globe, Menu, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../stores/useStore';
import { useUtcClock } from '../hooks';

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
  `;
  document.head.appendChild(el);
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
    { to: '/', label: 'DASHBOARD', icon: Globe },
    { to: '/satellites', label: 'SATELLITES', icon: List },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#030712' }}>

      {/* NAV */}
      <header style={{ position: 'sticky', top: 0, zIndex: 500, height: 60 }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .35, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,7,18,.94)', backdropFilter: 'blur(24px)' }} />
        {/* top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,#00c8ff 25%,#00c8ff 75%,transparent)', opacity: .6 }} />
        {/* bottom border */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'rgba(0,200,255,.1)' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1440, margin: '0 auto', padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Satellite style={{ width: 24, height: 24, color: '#00c8ff', filter: 'drop-shadow(0 0 8px #00c8ff)' }} strokeWidth={1.5} />
              <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: '#00ff88', border: '1.5px solid #030712', animation: '__blink 2s infinite,__glow 2s infinite', display: 'block' }} />
            </div>
            <span style={{ fontFamily: "'Orbitron',monospace", fontWeight: 900, fontSize: 17, letterSpacing: 5, color: '#fff', textShadow: '0 0 20px rgba(0,200,255,.5)' }}>SAT<span style={{ color: '#00c8ff' }}>TRACK</span></span>
          </Link>

          {/* UTC Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 16px', background: 'rgba(0,200,255,.04)', border: '1px solid rgba(0,200,255,.12)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', display: 'inline-block', animation: '__blink 1s infinite' }} />
            <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 12, letterSpacing: 2, color: '#00c8ff', textShadow: '0 0 10px rgba(0,200,255,.7)' }}>{utc}</span>
          </div>

          {/* Desktop Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {navLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link key={to} to={to} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '0 18px', height: 60,
                  fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: 2,
                  color: active ? '#00c8ff' : 'rgba(150,190,220,.55)',
                  background: active ? 'rgba(0,200,255,.06)' : 'transparent',
                  borderBottom: active ? '2px solid #00c8ff' : '2px solid transparent',
                  transition: 'all .2s',
                }}>
                  <Icon style={{ width: 13, height: 13 }} />
                  {label}
                </Link>
              );
            })}

            <div style={{ width: 1, height: 28, background: 'rgba(0,200,255,.1)', margin: '0 8px' }} />

            {token ? (
              <>
                <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', height: 60, fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: 1, color: 'rgba(150,190,220,.5)' }}>
                  <User style={{ width: 13, height: 13 }} />
                  {user?.username?.toUpperCase()}
                </Link>
                <button onClick={() => { clearAuth(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 60, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: 'rgba(255,80,60,.5)' }}>
                  <LogOut style={{ width: 13, height: 13 }} />
                </button>
              </>
            ) : (
              <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 60, fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: 2, color: 'rgba(150,190,220,.5)', borderLeft: '1px solid rgba(0,200,255,.1)' }}>
                <LogIn style={{ width: 13, height: 13 }} />
                SIGN IN
              </Link>
            )}

            <button onClick={() => setOpen(!open)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', height: 60, color: '#00c8ff' }} className="__mob">
              {open ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
            </button>
          </nav>
        </div>

        {open && (
          <div style={{ position: 'absolute', top: 60, left: 0, right: 0, zIndex: 2, background: 'rgba(3,7,18,.98)', borderBottom: '1px solid rgba(0,200,255,.1)', padding: '8px 24px 16px', animation: '__fadeIn .15s ease' }}>
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: '#00c8ff', fontFamily: "'Share Tech Mono',monospace", fontSize: 12, letterSpacing: 2, borderBottom: '1px solid rgba(0,200,255,.06)' }}>
                <Icon style={{ width: 14, height: 14 }} />{label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer style={{ height: 34, borderTop: '1px solid rgba(0,200,255,.06)', background: 'rgba(3,7,18,.95)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, overflow: 'hidden' }}>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2, color: 'rgba(0,200,255,.2)', whiteSpace: 'nowrap' }}>SGP4 · WGS-84</span>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ animation: '__ticker 50s linear infinite', whiteSpace: 'nowrap', fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: 'rgba(0,200,255,.15)' }}>
            {'ISS (ZARYA) · HUBBLE · CSS TIANHE · NOAA-19 · STARLINK · ONEWEB · GPS BLOCK III · GALILEO · BEIDOU · GLONASS · SENTINEL-6 · LANDSAT-9 · JAMES WEBB · AQUA · TERRA ·  '}
          </div>
        </div>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2, color: 'rgba(0,200,255,.2)', whiteSpace: 'nowrap' }}>CELESTRAK</span>
      </footer>

      <style>{`@media(max-width:768px){nav>a,nav>button:not(.__mob){display:none!important} .__mob{display:flex!important}}`}</style>
    </div>
  );
}
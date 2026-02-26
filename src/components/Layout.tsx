import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Satellite, Map, List, LogIn, LogOut, User,
  Globe, Activity, Menu, X
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../stores/useStore';
import { useUtcClock } from '../hooks';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user, clearAuth } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const now = useUtcClock();

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: Globe },
    { to: '/satellites', label: 'Satellites', icon: List },
  ];

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-space-950">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-space-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative">
                <Satellite
                  className="w-7 h-7 text-satellite-cyan group-hover:text-satellite-blue transition-colors"
                  strokeWidth={1.5}
                />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-satellite-green rounded-full animate-pulse" />
              </div>
              <span className="font-bold text-lg tracking-tight">
                <span className="text-white">Sat</span>
                <span className="text-satellite-cyan">Track</span>
              </span>
            </Link>

            {/* UTC Clock */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-gray-400">
              <Activity className="w-3 h-3 text-satellite-green animate-pulse" />
              <span>UTC {now.toISOString().split('T')[1].split('.')[0]}</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === to
                      ? 'bg-satellite-blue/20 text-satellite-blue'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}

              <div className="h-5 w-px bg-white/10 mx-2" />

              {token ? (
                <>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    {user?.username}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-gray-400 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-space-900 px-4 py-2">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-3 text-sm text-gray-300 hover:text-white"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            {!token && (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-3 text-sm text-gray-300 hover:text-white"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 text-center text-xs text-gray-600">
        <p>
          TLE data from{' '}
          <a href="https://celestrak.org" className="text-satellite-cyan hover:underline" target="_blank" rel="noreferrer">
            CelesTrak
          </a>
          {' '}· Orbital mechanics: SGP4 · Real-time tracking
        </p>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Satellite, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../services/api';
import { useStore } from '../stores/useStore';

export function Login() {
  const navigate = useNavigate();
  const { setAuth } = useStore();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(form.username, form.password);
      const profile = await authApi.profile();
      setAuth(res.token, profile);
      navigate('/');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-satellite-blue/20 rounded-2xl mb-3">
            <Satellite className="w-6 h-6 text-satellite-cyan" />
          </div>
          <h1 className="text-xl font-bold">Welcome back</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your SatTrack account</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-satellite-cyan"
              placeholder="your_username"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-satellite-cyan"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-satellite-cyan hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

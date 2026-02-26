import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Satellite } from 'lucide-react';
import { authApi } from '../services/api';
import { useStore } from '../stores/useStore';

export function Register() {
  const navigate = useNavigate();
  const { setAuth } = useStore();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.register(form.username, form.email, form.password);
      const profile = await authApi.profile();
      setAuth(res.token, profile);
      navigate('/');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-satellite-blue/20 rounded-2xl mb-3">
            <Satellite className="w-6 h-6 text-satellite-cyan" />
          </div>
          <h1 className="text-xl font-bold">Create account</h1>
          <p className="text-gray-400 text-sm mt-1">Start tracking satellites today</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {(['username', 'email', 'password'] as const).map(field => (
            <div key={field}>
              <label className="block text-xs text-gray-400 mb-1.5 capitalize">{field}</label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                required
                minLength={field === 'password' ? 8 : field === 'username' ? 3 : 1}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-satellite-cyan"
              />
            </div>
          ))}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-satellite-cyan hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

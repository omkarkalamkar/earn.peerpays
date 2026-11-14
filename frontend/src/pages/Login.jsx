import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const HOME = { admin: '/admin', cardholder: '/holder', booker: '/booker' };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        // Register new cardholder
        await api.post('/auth/register', {
          username: username.toLowerCase().trim(),
          password,
          name: name.trim(),
          phone: phone.trim(),
          role: 'cardholder', // Always cardholder for self-registration
        });
        // Auto-login after registration
        const user = await login(username, password);
        navigate(HOME[user.role] || '/');
      } else {
        // Login
        const user = await login(username, password);
        navigate(HOME[user.role] || '/');
      }
    } catch (err) {
      setError(err.response?.data?.message || (mode === 'register' ? 'Registration failed' : 'Login failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Desktop Branding Panel */}
      <div className="brand-gradient hidden flex-col justify-between p-10 text-white md:flex">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white p-1 shadow-sm">
            <img src="/logo.png" alt="PeerPays" className="h-full w-full object-contain" />
          </div>
          <span className="text-xl font-extrabold">
            PeerPays
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-200">
            Peer-to-Peer credit utility
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">
            Simplifying credit, amplifying rewards.
          </h1>
          <p className="mt-3 max-w-md text-white/80">
            Card holders put idle credit to work and earn, bookers redeem the best Amazon & Flipkart
            deals with a secure live OTP relay, and admins keep everything transparent.
          </p>
        </div>
        <p className="text-xs text-white/60">Secure, role-based access. Card data is encrypted.</p>
      </div>

      {/* Mobile & Login Form Side */}
      <div className="flex flex-col">
        {/* Mobile Header with Branding */}
        <div className="brand-gradient p-6 text-white md:hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-white p-1 shadow-sm">
              <img src="/logo.png" alt="PeerPays" className="h-full w-full object-contain" />
            </div>
            <span className="text-xl font-extrabold">PeerPays</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">
            Peer-to-Peer credit utility
          </p>
          <h2 className="mt-1 text-lg font-bold leading-tight">
            Simplifying credit, amplifying rewards.
          </h2>
          <p className="mt-2 text-xs text-white/80 leading-relaxed">
            Card holders earn by putting idle credit to work. Bookers redeem best deals with secure live OTP relay.
          </p>
        </div>

        {/* Login/Register Form */}
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <h2 className="text-2xl font-bold text-slate-800">
              {mode === 'login' ? 'Sign in' : 'Create Account'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'login' 
                ? 'Welcome back! Enter your credentials.' 
                : 'Register as a cardholder and start earning.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="label">Full Name</label>
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Phone Number</label>
                    <input
                      type="tel"
                      className="input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      required
                    />
                  </div>
                </>
              )}
              <div>
                <label className="label">Username</label>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === 'login' ? 'admin' : 'Choose a username'}
                  autoFocus={mode === 'login'}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Enter password' : 'Choose a strong password'}
                  required
                />
              </div>
              {error && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">
                  {error}
                </div>
              )}
              <button className="btn-primary btn-block" disabled={busy}>
                {busy 
                  ? (mode === 'login' ? 'Signing in...' : 'Creating account...') 
                  : (mode === 'login' ? 'Sign in' : 'Create account')}
              </button>
            </form>

            {/* Toggle Login/Register */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                  setUsername('');
                  setPassword('');
                  setName('');
                  setPhone('');
                }}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                {mode === 'login' 
                  ? "Don't have an account? Register as cardholder" 
                  : 'Already have an account? Sign in'}
              </button>
            </div>

            {mode === 'register' && (
              <p className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                💡 <strong>Note:</strong> Self-registration creates a cardholder account. 
                Contact admin for booker access.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 text-center">
          <p className="text-xs text-slate-500">
            🔒 Secure, role-based access. Card data is encrypted.
          </p>
        </div>
      </div>
    </div>
  );
}

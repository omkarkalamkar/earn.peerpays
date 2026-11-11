import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HOME = { admin: '/admin', cardholder: '/holder', booker: '/booker' };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(username, password);
      navigate(HOME[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
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

      <div className="flex flex-col p-6">
        <div className="flex items-center justify-center gap-2 pt-2 md:hidden">
          <img src="/logo.png" alt="PeerPays" className="h-11 w-11 rounded-xl object-contain" />
          <span className="flex flex-col leading-none">
            <span className="text-xl font-extrabold tracking-tight text-navy-900">PeerPays</span>
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-800">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use the credentials provided by your admin.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
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
                required
              />
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
            <button className="btn-primary btn-block" disabled={busy}>
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}

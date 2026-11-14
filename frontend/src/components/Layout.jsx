import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { enablePush, notificationPermission, pushSupported } from '../push';
import api from '../api/client';
import { Modal } from './ui';

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', short: 'Home', icon: 'grid', end: true },
  { to: '/admin/analytics', label: 'Analytics', short: 'Stats', icon: 'chart' },
  { to: '/admin/deals', label: 'Deals', short: 'Deals', icon: 'tag' },
  { to: '/admin/users', label: 'Users', short: 'Users', icon: 'users' },
  { to: '/admin/orders', label: 'Confirmed Orders', short: 'Orders', icon: 'check' },
  { to: '/admin/ledger', label: 'Ledger', short: 'Ledger', icon: 'list' },
  { to: '/admin/issues', label: 'Reported Issues', short: 'Issues', icon: 'alert' },
];

const NAV = {
  admin: ADMIN_NAV,
  viewer: ADMIN_NAV,
  cardholder: [
    { to: '/holder', label: 'Deals', short: 'Deals', icon: 'tag', end: true },
    { to: '/holder/cards', label: 'My Cards', short: 'Cards', icon: 'card' },
    { to: '/holder/bookings', label: 'My Bookings', short: 'Bookings', icon: 'list' },
    { to: '/holder/ledger', label: 'My Earnings', short: 'Earnings', icon: 'chart' },
  ],
  booker: [
    { to: '/booker', label: 'Available Deals', short: 'Deals', icon: 'tag', end: true },
    { to: '/booker/orders', label: 'My Orders', short: 'Orders', icon: 'list' },
    { to: '/booker/ledger', label: 'Ledger', short: 'Ledger', icon: 'chart' },
  ],
};

const ROLE_LABEL = { admin: 'Admin', viewer: 'Viewer', cardholder: 'Card Holder', booker: 'Booker' };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { notifications, unread, markAllRead, pushToast } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [perm, setPerm] = useState(() => notificationPermission());
  const [dismissedNotificationPrompt, setDismissedNotificationPrompt] = useState(() => {
    return localStorage.getItem('dismissedNotificationPrompt') === 'true';
  });
  const links = NAV[user.role] || [];

  useEffect(() => {
    setPerm(notificationPermission());
    // Ask for lock-screen notification permission as soon as the app opens (no button tap).
    // Some browsers (notably iOS Safari) still require a tap - the gate below enforces it.
    if (pushSupported() && notificationPermission() === 'default') {
      enablePush()
        .then(() => setPerm(notificationPermission()))
        .catch(() => {});
    }
  }, []);

  // Re-check permission when the user returns (e.g. after changing browser settings).
  useEffect(() => {
    const recheck = () => setPerm(notificationPermission());
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, []);

  async function handleEnableAlerts() {
    const res = await enablePush();
    setPerm(notificationPermission());
    if (res.ok) pushToast('Lock-screen alerts enabled on this device.');
    else if (res.reason === 'denied') pushToast('Notifications blocked. Enable them in browser settings.');
    else if (res.reason === 'server-disabled') pushToast('Push is not configured on the server.');
    else if (res.reason === 'unsupported') pushToast('This browser does not support push.');
    else pushToast('Could not enable alerts.');
  }

  const showEnable = pushSupported() && perm !== 'granted';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleDismissNotificationPrompt() {
    localStorage.setItem('dismissedNotificationPrompt', 'true');
    setDismissedNotificationPrompt(true);
  }

  // Show notification prompt only if not granted AND not dismissed
  const showNotificationGate = perm !== 'granted' && !dismissedNotificationPrompt;

  if (showNotificationGate) {
    return (
      <NotificationGate
        perm={perm}
        onEnable={handleEnableAlerts}
        onRecheck={() => setPerm(notificationPermission())}
        onLogout={handleLogout}
        onDismiss={handleDismissNotificationPrompt}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3 lg:gap-6">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="PeerPays"
                className="h-10 w-10 rounded-xl object-contain shadow-sm"
              />
              <div className="flex flex-col leading-none">
                <span className="text-base font-extrabold tracking-tight text-navy-900 sm:text-lg">
                  PeerPays
                </span>
                <span className="text-xs font-medium text-slate-500 mt-0.5 md:hidden">
                  {ROLE_LABEL[user.role]}
                </span>
              </div>
              <span className="chip ml-1 hidden bg-slate-100 text-slate-600 md:inline-flex">
                {ROLE_LABEL[user.role]}
              </span>
            </div>
            <nav className="hidden items-center gap-1 lg:flex">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 active:bg-slate-200'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {showEnable && (
              <button
                onClick={handleEnableAlerts}
                title="Get notifications on your lock screen"
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-300 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100 active:scale-95 transition-transform"
              >
                <Icon name="bell" />
                <span className="hidden sm:inline">Enable Alerts</span>
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => {
                  setOpen((o) => !o);
                  if (!open && unread) markAllRead();
                }}
                className="relative rounded-lg p-2.5 text-slate-600 hover:bg-slate-100 active:scale-95 transition-transform tap-highlight"
                aria-label="Notifications"
              >
                <Icon name="bell" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {open && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                    <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-800 bg-slate-50">
                      Notifications
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                      {notifications.length === 0 && (
                        <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</p>
                      )}
                      {notifications.map((n) => (
                        <div key={n._id} className="border-b border-slate-50 px-4 py-3 hover:bg-slate-50 transition-colors">
                          <p className="text-sm text-slate-700 leading-relaxed">{n.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="hidden text-right lg:block">
              <p className="text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">@{user.username}</p>
            </div>
            <button
              onClick={() => setPwOpen(true)}
              className="rounded-lg p-2.5 text-slate-600 hover:bg-slate-100 active:scale-95 transition-transform tap-highlight hidden sm:block"
              aria-label="Change password"
              title="Change password"
            >
              <Icon name="key" />
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2.5 text-slate-600 hover:bg-slate-100 active:scale-95 transition-transform tap-highlight sm:hidden"
              aria-label="Logout"
            >
              <Icon name="logout" />
            </button>
            <button onClick={handleLogout} className="btn-secondary hidden sm:inline-flex">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:py-6 md:pb-6">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden safe-area-pb"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors tap-highlight ${
                  isActive ? 'text-brand-600' : 'text-slate-500 active:text-slate-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-9 w-12 place-items-center rounded-xl transition-all ${
                      isActive ? 'bg-brand-50 scale-105' : 'active:scale-95'
                    }`}
                  >
                    <Icon name={l.icon} />
                  </span>
                  <span className="leading-tight">{l.short}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} pushToast={pushToast} />
    </div>
  );
}

function ChangePasswordModal({ open, onClose, pushToast }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (next !== confirm) {
      pushToast('New passwords do not match');
      return;
    }
    if (next.length < 6) {
      pushToast('New password must be at least 6 characters');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      pushToast('Password changed successfully');
      setCur('');
      setNext('');
      setConfirm('');
      onClose();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Could not change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change password">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Current password</label>
          <input
            type="password"
            className="input"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">New password</label>
          <input
            type="password"
            className="input"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </Modal>
  );
}

function NotificationGate({ perm, onEnable, onRecheck, onLogout, onDismiss }) {
  const [busy, setBusy] = useState(false);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);

  async function enable() {
    setBusy(true);
    try {
      await onEnable();
    } finally {
      setBusy(false);
    }
  }

  let title = 'Enable notifications (recommended)';
  let body =
    'Stay updated with real-time alerts for deals, OTP requests, and order updates. You can enable this anytime later from settings.';
  let action = (
    <>
      <button className="btn-primary btn-block" disabled={busy} onClick={enable}>
        {busy ? 'Requesting…' : '🔔 Enable notifications'}
      </button>
      <button className="btn-secondary btn-block mt-2" onClick={onDismiss}>
        Maybe later
      </button>
    </>
  );

  if (perm === 'denied') {
    title = 'Notifications are blocked';
    body =
      'You previously blocked notifications. Please allow them for this site in your browser settings, then tap "I\'ve enabled it".';
    action = (
      <>
        <button className="btn-primary btn-block" onClick={onRecheck}>
          I&apos;ve enabled it — re-check
        </button>
        <button className="btn-secondary btn-block mt-2" onClick={onDismiss}>
          Continue without notifications
        </button>
      </>
    );
  } else if (perm === 'unsupported') {
    if (isIOS && !isStandalone) {
      title = 'Add PeerPays to your Home Screen';
      body =
        'On iPhone, notifications work only when the app is installed. Tap the Share button in Safari, choose "Add to Home Screen", then open PeerPays from your home screen.';
    } else {
      title = 'Notifications not supported';
      body =
        'Your current browser does not support notifications. Please open PeerPays in Chrome (Android) or install it to your home screen.';
    }
    action = (
      <>
        <button className="btn-primary btn-block" onClick={onRecheck}>
          Re-check
        </button>
        <button className="btn-secondary btn-block mt-2" onClick={onDismiss}>
          Continue anyway
        </button>
      </>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6 py-10"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
        <img src="/logo.png" alt="PeerPays" className="mx-auto h-14 w-14 rounded-xl object-contain" />
        <div className="mx-auto mt-4 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Icon name="bell" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-navy-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{body}</p>
        <div className="mt-5">{action}</div>
        <button onClick={onLogout} className="mt-4 text-xs font-medium text-slate-400 underline">
          Log out
        </button>
      </div>
    </div>
  );
}

function Icon({ name }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  const paths = {
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    tag: (
      <>
        <path d="M20.59 13.41 11 3.99a2 2 0 0 0-1.41-.58H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.41 9.41a2 2 0 0 0 2.83 0l4.76-4.76a2 2 0 0 0 0-2.83Z" />
        <circle cx="7.5" cy="7.5" r="0.5" fill="currentColor" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    check: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    key: (
      <>
        <circle cx="7.5" cy="15.5" r="3.5" />
        <path d="M10 13l6-6" />
        <path d="M14 5l3 3" />
        <path d="M17.5 4.5l2 2" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <rect x="7" y="12" width="3" height="6" rx="0.5" />
        <rect x="12" y="8" width="3" height="10" rx="0.5" />
        <rect x="17" y="5" width="3" height="13" rx="0.5" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] || paths.grid}</svg>;
}

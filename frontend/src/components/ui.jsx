import { useEffect, useRef, useState } from 'react';

const STATUS_STYLES = {
  SUBMITTED: 'bg-amber-100 text-amber-700',
  OTP_REQUESTED: 'bg-purple-100 text-purple-700',
  OTP_APPROVED: 'bg-indigo-100 text-indigo-700',
  OTP_SUBMITTED: 'bg-cyan-100 text-cyan-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-200 text-slate-600',
};

const STATUS_LABELS = {
  SUBMITTED: 'Waiting for booker',
  OTP_REQUESTED: 'Placing order',
  OTP_APPROVED: 'Awaiting OTP',
  OTP_SUBMITTED: 'OTP shared',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }) {
  return (
    <span className={`chip ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function PlatformBadge({ platform }) {
  const platformConfig = {
    'Amazon': { 
      bg: 'bg-orange-50', 
      text: 'text-orange-700',
      border: 'border-orange-200',
      icon: '📦'
    },
    'Flipkart': { 
      bg: 'bg-blue-50', 
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: '🛒'
    },
    'Croma': { 
      bg: 'bg-green-50', 
      text: 'text-green-700',
      border: 'border-green-200',
      icon: '🏪'
    },
    'Reliance Digital': { 
      bg: 'bg-red-50', 
      text: 'text-red-700',
      border: 'border-red-200',
      icon: '🏬'
    },
    'Swiggy': { 
      bg: 'bg-orange-50', 
      text: 'text-orange-700',
      border: 'border-orange-200',
      icon: '🍔'
    },
    'Zepto': { 
      bg: 'bg-purple-50', 
      text: 'text-purple-700',
      border: 'border-purple-200',
      icon: '⚡'
    },
    'Blinkit': { 
      bg: 'bg-yellow-50', 
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      icon: '🛍️'
    },
    'BigBasket': { 
      bg: 'bg-green-50', 
      text: 'text-green-700',
      border: 'border-green-200',
      icon: '🥕'
    },
    'Others': { 
      bg: 'bg-slate-50', 
      text: 'text-slate-700',
      border: 'border-slate-200',
      icon: '🏷️'
    },
  };
  
  const config = platformConfig[platform] || { 
    bg: 'bg-slate-100', 
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: '🏷️'
  };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${config.bg} ${config.text} ${config.border}`}>
      <span className="text-base">{config.icon}</span>
      {platform}
    </span>
  );
}

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1 py-14 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  if (!open) return null;
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-[slideUp_0.25s_ease-out] sm:rounded-2xl sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Mobile drag handle */}
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-200 active:scale-95 transition-transform tap-highlight"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function money(n) {
  return '\u20b9' + Number(n).toLocaleString('en-IN');
}

function msLeft(deadline) {
  if (!deadline) return 0;
  return Math.max(0, new Date(deadline).getTime() - Date.now());
}

/**
 * Live mm:ss countdown to `deadline` (ISO string). Calls `onExpire` once when it hits 0.
 * Turns red in the last 30 seconds.
 */
export function Countdown({ deadline, onExpire, className = '' }) {
  const [left, setLeft] = useState(() => msLeft(deadline));
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    setLeft(msLeft(deadline));
    const id = setInterval(() => {
      const rem = msLeft(deadline);
      setLeft(rem);
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        if (onExpire) onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  const total = Math.ceil(left / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  const danger = left > 0 && left <= 30000;

  return (
    <span
      className={`font-mono font-semibold tabular-nums ${
        left <= 0 ? 'text-rose-600' : danger ? 'text-rose-600' : 'text-slate-700'
      } ${className}`}
    >
      {left <= 0 ? 'Expired' : `${mm}:${ss}`}
    </span>
  );
}

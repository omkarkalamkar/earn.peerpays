import { useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { Spinner, EmptyState, StatusBadge, PlatformBadge, Modal, money, Countdown } from '../../components/ui';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useNotifications } from '../../context/NotificationContext';

/**
 * Group orders by card holder (holderRef), keeping a holder's cards together and ordering
 * holders first-come-first-serve (earliest submission first).
 */
function groupByHolder(items) {
  const ts = (x) => (x?.createdAt ? new Date(x.createdAt).getTime() : 0);
  const map = new Map();
  (items || []).forEach((b) => {
    const key = b.holderRef || b._id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  });
  const entries = [...map.entries()];
  entries.forEach(([, arr]) => arr.sort((a, b) => ts(a) - ts(b)));
  entries.sort((a, b) => ts(a[1][0]) - ts(b[1][0]));
  return entries;
}

export default function BookerOrders() {
  const [bookings, setBookings] = useState(null);

  function load() {
    api.get('/bookings/assigned').then((res) => setBookings(res.data.bookings));
  }
  useEffect(load, []);
  // Ensure a submitted OTP always lands on the booker's screen, even if the live
  // socket event was missed (phone locked / app backgrounded / reconnect).
  useLiveRefresh(load);

  useSocketEvent(
    'booking:update',
    (b) => {
      setBookings((list) => {
        if (!list) return list;
        const exists = list.some((x) => x._id === b._id);
        return exists ? list.map((x) => (x._id === b._id ? b : x)) : [b, ...list];
      });
    },
    []
  );

  useSocketEvent(
    'otp:update',
    ({ bookingId, otp }) => {
      setBookings((list) => (list ? list.map((x) => (x._id === bookingId ? { ...x, otpCurrent: otp } : x)) : list));
    },
    []
  );

  if (!bookings) return <Spinner />;
  const active = bookings.filter((b) => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(b.status));
  const done = bookings.filter((b) => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(b.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">My Orders</h1>
        <p className="text-sm text-slate-500">Place orders and relay OTPs with your card holders in real time.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Active</h2>
        {active.length === 0 ? (
          <EmptyState title="No active orders" subtitle="Accept a submission from Available Deals." />
        ) : (
          groupByHolder(active).map(([ref, items]) => (
            <div key={ref} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">{items[0]?.holderUsername || ref}</span>
                <span className="chip bg-white text-slate-500">{items.length} card(s)</span>
                <span className="text-[11px] text-slate-400">Finish this card holder's cards together</span>
              </div>
              {items.map((b) => (
                <OrderRow key={b._id} booking={b} onChange={load} />
              ))}
            </div>
          ))
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">History</h2>
          {done.map((b) => (
            <OrderRow key={b._id} booking={b} onChange={load} />
          ))}
        </section>
      )}
    </div>
  );
}

function OrderRow({ booking, onChange }) {
  const { pushToast } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState(false);
  const [card, setCard] = useState(null);
  const fileRef = useRef(null);
  const [showRingButton, setShowRingButton] = useState(false);
  const d = booking.deal || {};

  // Show ring button after 1 minute of OTP being sent, but ONLY if OTP not yet entered
  useEffect(() => {
    if (booking.otpDeadline && booking.status === 'OTP_APPROVED' && !booking.otpCurrent) {
      const otpSentTime = new Date(booking.otpDeadline).getTime() - 3 * 60 * 1000; // OTP deadline - 3 mins
      const oneMinuteLater = otpSentTime + 60 * 1000;
      const now = Date.now();
      
      if (now >= oneMinuteLater) {
        // Already past 1 minute
        setShowRingButton(true);
      } else {
        // Set timer for 1 minute
        const timer = setTimeout(() => {
          setShowRingButton(true);
        }, oneMinuteLater - now);
        return () => clearTimeout(timer);
      }
    } else {
      setShowRingButton(false);
    }
  }, [booking.otpDeadline, booking.status, booking.otpCurrent]);

  async function viewCard() {
    try {
      const res = await api.get(`/bookings/${booking._id}/card`);
      setCard(res.data.card);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Cannot view card');
    }
  }

  async function act(url, body) {
    setBusy(true);
    try {
      await api.post(url, body);
      onChange();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function uploadScreenshot(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('screenshot', file);
      await api.post(`/bookings/${booking._id}/screenshot`, fd);
      pushToast('Screenshot uploaded');
      onChange();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  const canRelayOtp = ['OTP_REQUESTED', 'OTP_APPROVED', 'OTP_SUBMITTED'].includes(booking.status);
  const canComplete = ['OTP_APPROVED', 'OTP_SUBMITTED'].includes(booking.status);
  const canFail = ['OTP_REQUESTED', 'OTP_APPROVED', 'OTP_SUBMITTED'].includes(
    booking.status
  );
  const canViewCard = !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(booking.status);

  function markFailed() {
    if (window.confirm('Mark this order as failed? The card holder will be notified and this deal ends.')) {
      act(`/bookings/${booking._id}/fail`);
    }
  }

  async function ringHolder() {
    try {
      await api.post(`/bookings/${booking._id}/ring-holder`);
      pushToast('🔔 Card holder notified!');
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to ring');
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <PlatformBadge platform={d.platform} />
            <StatusBadge status={booking.status} />
          </div>
          <h3 className="text-[15px] font-semibold text-navy-900">{d.title}</h3>
          <p className="text-[13px] text-slate-500">
            {d.product} - {money(d.price || 0)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-500">{booking.holderUsername || booking.holderRef}</span> ·
            Ref #{booking.ref} | Card: {booking.card?.bank} ****{booking.card?.last4}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {canViewCard && (
          <button className="btn-secondary btn-xs" onClick={viewCard}>
            View card
          </button>
        )}

        {booking.status === 'OTP_REQUESTED' && (
          <p className="rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-700">
            Waiting for the card holder to tap "OK, proceed"…
          </p>
        )}

        {canRelayOtp && booking.status !== 'OTP_REQUESTED' && (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-cyan-800">
                {!booking.otpDeadline
                  ? 'Trigger the OTP on the payment page, then press "OTP sent" below.'
                  : booking.otpCurrent
                  ? 'Live OTP from card holder'
                  : 'Waiting for card holder to enter the OTP…'}
              </p>
              {booking.otpDeadline && (
                <span className="whitespace-nowrap text-xs text-slate-500">
                  Auto-reject in{' '}
                  <Countdown deadline={booking.otpDeadline} onExpire={() => setTimeout(onChange, 2500)} />
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <span className="select-all font-mono text-3xl font-bold tracking-[0.2em] text-slate-900">
                {booking.otpCurrent || '– – – – – –'}
              </span>
              <div className="flex items-center gap-2">
                {booking.otpCurrent ? (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      navigator.clipboard?.writeText(booking.otpCurrent);
                      pushToast('OTP copied');
                    }}
                  >
                    Copy
                  </button>
                ) : showRingButton ? (
                  <button
                    className="btn-warning"
                    onClick={ringHolder}
                    title="Cardholder not responding? Ring them!"
                  >
                    🔔 Ring Cardholder
                  </button>
                ) : null}
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => act(`/bookings/${booking._id}/resend-otp`)}
                >
                  Resend OTP
                </button>
              </div>
            </div>
            <div className="mt-2">
              <button
                className="btn-success btn-xs"
                disabled={busy}
                onClick={() => act(`/bookings/${booking._id}/otp-sent`)}
              >
                {booking.otpDeadline ? 'Restart 3-min timer' : 'OTP sent — start 3-min timer'}
              </button>
              <p className="mt-1 text-xs text-slate-400">
                Press when you trigger the OTP on the payment page. Complete the order within 3 minutes or it
                auto-rejects.
              </p>
            </div>
            {booking.resendCount > 0 && (
              <p className="mt-1 text-xs text-slate-400">Resend requested {booking.resendCount} time(s).</p>
            )}
          </div>
        )}

        {canComplete && (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-700">Finish the order</p>
            <p className="text-xs text-slate-400">
              Optionally upload the order confirmation screenshot, then mark complete.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadScreenshot} />
              <button className="btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                {booking.screenshotUrl ? 'Replace screenshot' : 'Upload screenshot (optional)'}
              </button>
              {booking.screenshotUrl && (
                <button className="btn-secondary" onClick={() => setProof(true)}>
                  Preview
                </button>
              )}
              <button
                className="btn-success"
                disabled={busy}
                onClick={() => act(`/bookings/${booking._id}/complete`)}
              >
                Mark order complete
              </button>
            </div>
          </div>
        )}

        {canFail && (
          <button
            className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            disabled={busy}
            onClick={markFailed}
          >
            Order failed
          </button>
        )}

        {booking.status === 'COMPLETED' && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            <p>Completed on {booking.completedAt ? new Date(booking.completedAt).toLocaleString() : '-'}.</p>
            {booking.screenshotUrl && (
              <button className="mt-1 text-emerald-700 underline" onClick={() => setProof(true)}>
                View proof
              </button>
            )}
          </div>
        )}

        {booking.status === 'REJECTED' && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">You rejected this submission.</p>
        )}
      </div>

      <Modal open={proof} onClose={() => setProof(false)} title="Order screenshot">
        {booking.screenshotUrl && <img src={booking.screenshotUrl} alt="order" className="w-full rounded-lg" />}
      </Modal>

      <Modal open={!!card} onClose={() => setCard(null)} title="Shared card details">
        {card && (
          <div className="brand-gradient rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase">{card.bank}</span>
              <span className="chip bg-white/20 text-white">{card.type}</span>
            </div>
            <p className="mt-5 select-all font-mono text-lg tracking-widest">{card.number}</p>
            <div className="mt-4 flex justify-between text-sm">
              <div>
                <p className="text-[10px] uppercase text-slate-300">Holder</p>
                <p>{card.holderName}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase text-slate-300">Expires</p>
                <p>
                  {String(card.expiryMonth).padStart(2, '0')}/{String(card.expiryYear).slice(-2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-slate-300">CVV</p>
                <p className="select-all font-mono">{card.cvv || '—'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

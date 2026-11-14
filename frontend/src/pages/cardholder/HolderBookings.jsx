import { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { Spinner, EmptyState, StatusBadge, PlatformBadge, money, Countdown } from '../../components/ui';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useNotifications } from '../../context/NotificationContext';

/**
 * Play urgent alarm sound for OTP time warning
 * Uses Web Audio API to generate a beeping alarm
 */
function playUrgentAlarm() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Play 3 beeps with increasing pitch
    const beeps = [
      { freq: 800, time: 0 },
      { freq: 1000, time: 0.3 },
      { freq: 1200, time: 0.6 },
    ];
    
    beeps.forEach(({ freq, time }) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.2);
      
      oscillator.start(audioContext.currentTime + time);
      oscillator.stop(audioContext.currentTime + time + 0.2);
    });
  } catch (err) {
    console.warn('Failed to play alarm sound:', err);
  }
}

/**
 * Play ringing notification sound when OTP is sent
 * Longer, more prominent than the warning sound
 */
function playOtpRingingSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Play a longer ringing pattern - 5 rings
    const rings = [
      { freq: 900, time: 0, duration: 0.15 },
      { freq: 1100, time: 0.2, duration: 0.15 },
      { freq: 900, time: 0.4, duration: 0.15 },
      { freq: 1100, time: 0.6, duration: 0.15 },
      { freq: 1300, time: 0.8, duration: 0.25 }, // Final longer ring
    ];
    
    rings.forEach(({ freq, time, duration }) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime + time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + duration);
      
      oscillator.start(audioContext.currentTime + time);
      oscillator.stop(audioContext.currentTime + time + duration);
    });
  } catch (err) {
    console.warn('Failed to play ringing sound:', err);
  }
}

export default function HolderBookings() {
  const [bookings, setBookings] = useState(null);
  const { pushToast } = useNotifications();

  function load() {
    api.get('/bookings/mine').then((res) => setBookings(res.data.bookings));
  }
  useEffect(load, []);
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

  // Handle 1-minute OTP warning with sound alert
  useSocketEvent(
    'otp:time-warning',
    (data) => {
      const { bookingId, timeRemaining, playSound } = data;
      
      // Play urgent alarm sound
      if (playSound) {
        playUrgentAlarm();
      }
      
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⚠️ URGENT: OTP Time Running Out!', {
          body: `Less than ${timeRemaining} seconds left! Complete OTP now!`,
          icon: '/logo-192.png',
          tag: `otp-warning-${bookingId}`,
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
        });
      }
      
      // Show in-app toast
      pushToast('⏰ URGENT: Less than 1 minute left for OTP!', 'warning');
      
      // Refresh bookings to show updated countdown
      load();
    },
    [pushToast]
  );

  // Handle OTP sent alert with ringing sound
  useSocketEvent(
    'otp:sent-alert',
    (data) => {
      const { bookingId, playSound, message, isResend } = data;
      
      // Play ringing notification sound
      if (playSound) {
        playOtpRingingSound();
      }
      
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(isResend ? '🔔 New OTP Requested!' : '🔔 OTP Sent to Your Phone!', {
          body: message || 'Please enter the OTP you received within 3 minutes.',
          icon: '/logo-192.png',
          tag: `otp-sent-${bookingId}`,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300, 100, 300],
        });
      }
      
      // Show prominent in-app toast
      pushToast(isResend ? '🔔 NEW OTP! Enter the latest one now!' : '🔔 OTP SENT! Check your phone and enter it!', 'info');
      
      // Refresh bookings to show OTP entry form
      load();
    },
    [pushToast]
  );

  const earnings = useMemo(() => {
    const list = bookings || [];
    const isToday = (d) => {
      if (!d) return false;
      const t = new Date(d);
      const now = new Date();
      return (
        t.getFullYear() === now.getFullYear() &&
        t.getMonth() === now.getMonth() &&
        t.getDate() === now.getDate()
      );
    };
    let today = 0;
    let lifetime = 0;
    let ordersToday = 0;
    let ordersTotal = 0;
    for (const b of list) {
      if (b.status !== 'COMPLETED') continue;
      const p = Number(b.deal?.profit || 0);
      lifetime += p;
      ordersTotal += 1;
      if (isToday(b.completedAt)) {
        today += p;
        ordersToday += 1;
      }
    }
    return { today, lifetime, ordersToday, ordersTotal };
  }, [bookings]);

  if (!bookings) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">My Bookings</h1>
        <p className="text-sm text-slate-500">Track your submitted deals and complete the OTP step.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="brand-gradient rounded-xl p-4 text-white shadow-md">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">Today</p>
          <p className="mt-1.5 text-xl font-bold">{money(earnings.today)}</p>
          <p className="mt-0.5 text-[11px] text-white/70">
            {earnings.ordersToday} {earnings.ordersToday === 1 ? 'order' : 'orders'}
          </p>
        </div>
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Lifetime</p>
          <p className="mt-1.5 text-xl font-bold text-emerald-800">{money(earnings.lifetime)}</p>
          <p className="mt-0.5 text-[11px] text-emerald-600">
            {earnings.ordersTotal} {earnings.ordersTotal === 1 ? 'order' : 'orders'}
          </p>
        </div>
      </div>

      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" subtitle="Submit a card to a deal to get started." />
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <BookingRow key={b._id} booking={b} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({ booking, onChange }) {
  const { pushToast } = useNotifications();
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  
  // Check if OTP time is critical (< 60 seconds)
  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (!booking.otpDeadline) return;
    
    const updateTime = () => {
      const remaining = new Date(booking.otpDeadline) - new Date();
      setTimeLeft(Math.max(0, Math.floor(remaining / 1000)));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [booking.otpDeadline]);
  
  const isCritical = timeLeft > 0 && timeLeft <= 60;

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

  const d = booking.deal || {};
  const otpSent = !!booking.otpDeadline;
  const showOtpEntry = ['OTP_APPROVED', 'OTP_SUBMITTED'].includes(booking.status) && otpSent;
  const waitingForOtpSend = booking.status === 'OTP_APPROVED' && !otpSent;

  return (
    <div className="card p-4 sm:p-5">
      <div className="space-y-3">
        {/* Header Section */}
        <div className="flex flex-wrap items-start gap-2">
          <PlatformBadge platform={d.platform} />
          <StatusBadge status={booking.status} />
        </div>
        
        {/* Deal Info */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-navy-900 leading-snug">{d.title}</h3>
          <p className="text-sm text-slate-600 mt-1">
            {d.product} - {money(d.price || 0)}
          </p>
          {d.profit > 0 && (
            <p className="mt-2 text-base font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 inline-block">
              💰 You earn {money(d.profit)}
            </p>
          )}
        </div>
        
        {/* Card & Booker Info */}
        <div className="text-xs sm:text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2 space-y-1">
          <p>
            <span className="font-medium text-slate-700">Card:</span> {booking.card?.bank} ****{booking.card?.last4}
          </p>
          {booking.bookerRef && (
            <p>
              <span className="font-medium text-slate-700">Booker:</span>{' '}
              <span className="font-mono text-slate-900">{booking.bookerRef}</span>
            </p>
          )}
        </div>
      </div>

      {/* Stage-specific actions */}
      <div className="mt-4">
        {booking.status === 'SUBMITTED' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">⏳ Waiting for Booker</p>
            <p className="text-xs mt-1 text-amber-700">A booker will review and accept your card soon.</p>
          </div>
        )}

        {booking.status === 'OTP_REQUESTED' && (
          <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 space-y-3">
            <div>
              <p className="font-medium text-purple-900">🔔 Ready to Place Order</p>
              <p className="text-sm text-purple-700 mt-1">
                The booker is ready to place your order and will trigger the OTP to your phone. Proceed?
              </p>
            </div>
            <button
              className="btn-success w-full"
              disabled={busy}
              onClick={() => act(`/bookings/${booking._id}/approve-otp`)}
            >
              ✓ Yes, Proceed with Order
            </button>
          </div>
        )}

        {waitingForOtpSend && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800">
            <p className="font-medium">⏰ All Set!</p>
            <p className="text-xs mt-1 text-indigo-700">
              Waiting for the booker to trigger the OTP. The entry box will appear here automatically.
            </p>
          </div>
        )}

        {showOtpEntry && (
          <div className={`rounded-xl p-4 border-2 transition-all space-y-3 ${
            isCritical 
              ? 'bg-rose-50 border-rose-400 animate-pulse' 
              : 'bg-cyan-50 border-cyan-300'
          }`}>
            {isCritical && (
              <div className="flex items-center gap-2 bg-rose-100 rounded-lg px-3 py-2">
                <span className="text-2xl">⚠️</span>
                <span className="text-sm font-bold text-rose-900">URGENT: Less than 1 minute left!</span>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex-1">
                <p className={`text-sm font-medium ${isCritical ? 'text-rose-900' : 'text-cyan-900'}`}>
                  📱 Enter OTP from Your Phone
                </p>
                <p className={`text-xs mt-1 ${isCritical ? 'text-rose-700' : 'text-cyan-700'}`}>
                  The OTP will be shared live with the booker
                </p>
              </div>
              {booking.otpDeadline && (
                <div className={`text-center sm:text-right ${isCritical ? 'bg-rose-100 rounded-lg px-3 py-2' : ''}`}>
                  <p className="text-xs text-slate-600 font-medium">Time Remaining</p>
                  <span className="text-lg font-bold">
                    <Countdown 
                      deadline={booking.otpDeadline} 
                      onExpire={() => setTimeout(onChange, 2500)}
                    />
                  </span>
                </div>
              )}
            </div>
            
            {booking.resendCount > 0 && (
              <div className="bg-rose-100 border border-rose-300 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-rose-800">
                  🔄 New OTP Requested (Resend #{booking.resendCount})
                </p>
                <p className="text-xs text-rose-700 mt-1">Please enter the latest OTP you received</p>
              </div>
            )}
            
            <div className="mt-2 flex flex-col sm:flex-row gap-3">
              <input
                className={`input-otp ${isCritical ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                inputMode="numeric"
                placeholder="••••••"
                maxLength="6"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              <button
                className={`whitespace-nowrap ${isCritical ? 'btn-danger' : 'btn-primary'} ${!isCritical && 'sm:w-auto w-full'}`}
                disabled={busy || !otp}
                onClick={() => act(`/bookings/${booking._id}/otp`, { code: otp })}
              >
                {busy ? 'Sharing...' : isCritical ? '⚡ SHARE NOW!' : '✓ Share OTP'}
              </button>
            </div>
            
            {booking.otpCurrent && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-2.5">
                <p className="text-xs text-emerald-700 font-medium">✓ OTP Shared Successfully</p>
                <p className="text-xl font-mono font-bold text-emerald-900 mt-1 tracking-wider text-center">
                  {booking.otpCurrent}
                </p>
              </div>
            )}
          </div>
        )}

        {booking.status === 'COMPLETED' && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4">
            <p className="font-medium text-emerald-900 flex items-center gap-2">
              <span className="text-xl">✅</span> Order Completed Successfully!
            </p>
            <p className="text-sm text-emerald-700 mt-1">Thank you! Your earnings have been recorded.</p>
          </div>
        )}

        {booking.status === 'REJECTED' && (
          <div className="rounded-xl bg-rose-50 border border-rose-300 px-4 py-3">
            <p className="font-medium text-rose-900 flex items-center gap-2">
              <span className="text-xl">❌</span> Order Could Not Be Completed
            </p>
            <p className="text-sm text-rose-700 mt-1">The booker was unable to use this card for the deal.</p>
          </div>
        )}
      </div>
    </div>
  );
}

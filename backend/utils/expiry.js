const Booking = require('../models/Booking');
const { notify } = require('./notify');
const { emitToUser, emitToBookers } = require('./socket');
const {
  populated,
  serializeForHolder,
  serializeForBooker,
} = require('../controllers/bookingController');

const SUBMISSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const SWEEP_INTERVAL_MS = 20 * 1000; // check every 20s
const ONE_MINUTE_WARNING_MS = 60 * 1000; // 1 minute warning threshold

// Track bookings that have already received the 1-minute warning
const warnedBookings = new Set();

/** Auto-reject a booking and inform both sides. */
async function autoReject(booking, reason) {
  booking.status = 'REJECTED';
  booking.otpDeadline = null;
  booking.otpCurrent = null;
  await booking.save();

  const full = await populated(booking._id);
  const holderId = String(full.cardHolder._id || full.cardHolder);
  await notify(holderId, 'DEAL_REJECTED', reason, full._id);
  emitToUser(holderId, 'booking:update', serializeForHolder(full));

  if (full.booker) {
    const bookerId = String(full.booker._id || full.booker);
    await notify(bookerId, 'DEAL_REJECTED', reason, full._id);
    emitToUser(bookerId, 'booking:update', serializeForBooker(full));
  }
  // Refresh bookers' available list (in case it was still an open submission).
  emitToBookers('booking:taken', { bookingId: String(full._id) });
}

async function sweep() {
  const now = new Date();

  // 1) Submissions not accepted within 12 hours -> reject.
  const stale = await Booking.find({
    status: 'SUBMITTED',
    createdAt: { $lt: new Date(now.getTime() - SUBMISSION_TTL_MS) },
  });
  for (const b of stale) {
    await autoReject(b, 'Your deal expired — no booker accepted it within 12 hours.');
  }

  // 2) Check for bookings with 1 minute or less remaining (warning)
  const oneMinuteFromNow = new Date(now.getTime() + ONE_MINUTE_WARNING_MS);
  const nearExpiry = await Booking.find({
    otpDeadline: { $ne: null, $gt: now, $lte: oneMinuteFromNow },
    status: { $in: ['ACCEPTED', 'OTP_REQUESTED', 'OTP_APPROVED', 'OTP_SUBMITTED'] },
  });
  
  for (const b of nearExpiry) {
    const bookingId = String(b._id);
    // Only warn once per booking
    if (!warnedBookings.has(bookingId)) {
      warnedBookings.add(bookingId);
      const full = await populated(b._id);
      const holderId = String(full.cardHolder._id || full.cardHolder);
      
      // Send urgent notification to cardholder
      await notify(holderId, 'OTP_TIME_WARNING', '⚠️ URGENT: Less than 1 minute left to complete OTP! Time is running out!', full._id);
      
      // Emit socket event with sound flag
      emitToUser(holderId, 'otp:time-warning', { 
        bookingId: String(full._id),
        timeRemaining: Math.floor((b.otpDeadline - now) / 1000), // seconds
        urgent: true,
        playSound: true
      });
      
      console.log(`[expiry] 1-min warning sent to ${holderId} for booking ${bookingId}`);
    }
  }

  // 3) OTP window (3 min) elapsed without completion -> reject.
  const otpExpired = await Booking.find({
    otpDeadline: { $ne: null, $lt: now },
    status: { $in: ['ACCEPTED', 'OTP_REQUESTED', 'OTP_APPROVED', 'OTP_SUBMITTED'] },
  });
  for (const b of otpExpired) {
    const bookingId = String(b._id);
    warnedBookings.delete(bookingId); // Clean up
    await autoReject(b, 'OTP time window (3 minutes) expired — the order was not completed in time.');
  }
}

function startExpirySweeper() {
  sweep().catch((e) => console.error('[expiry] sweep error', e.message));
  setInterval(() => sweep().catch((e) => console.error('[expiry] sweep error', e.message)), SWEEP_INTERVAL_MS);
  console.log('[expiry] sweeper started (12h submissions, 3-min OTP window)');
}

module.exports = { startExpirySweeper };

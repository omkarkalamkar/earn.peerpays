require('dotenv').config();
const { connectDB, disconnectDB } = require('./config/db');
const Booking = require('./models/Booking');
// Ensure referenced models are registered so .populate() works in this standalone script.
require('./models/Deal');
require('./models/Card');
require('./models/User');
const { archiveCompletedOrder } = require('./utils/orderStats');

/**
 * One-time (idempotent) backfill: creates OrderStat archive entries and deal
 * snapshots for orders that were COMPLETED before the analytics ledger existed.
 *
 * Safe to run multiple times — the unique `booking` index prevents duplicates.
 *
 * Usage: node backfill-stats.js
 */
(async () => {
  await connectDB();

  const completed = await Booking.find({ status: 'COMPLETED' })
    .populate('deal')
    .populate('cardHolder', 'name username phone')
    .populate('booker', 'name username')
    .populate('card', 'bank network type last4');

  let done = 0;
  for (const booking of completed) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await archiveCompletedOrder(booking);
      done += 1;
    } catch (e) {
      console.error(`[backfill] booking ${booking._id} failed:`, e.message);
    }
  }

  console.log(`[backfill] Archived/ensured ${done} of ${completed.length} completed orders.`);
  await disconnectDB();
  process.exit(0);
})().catch((e) => {
  console.error('[backfill] Failed:', e.message);
  process.exit(1);
});

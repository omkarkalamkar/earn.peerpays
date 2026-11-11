const OrderStat = require('../models/OrderStat');

/**
 * Archive a completed order into the append-only OrderStat ledger and stamp a
 * deal snapshot onto the booking. Idempotent: the unique `booking` index means
 * re-running (e.g. backfill) will not create duplicates.
 *
 * @param {import('mongoose').Document} booking A booking with `deal`, `cardHolder`,
 *   `booker` and `card` populated.
 */
async function archiveCompletedOrder(booking) {
  const deal = booking.deal || {};
  const holder = booking.cardHolder || {};
  const booker = booking.booker || {};
  const card = booking.card || {};

  const snapshot = {
    title: deal.title,
    platform: deal.platform,
    product: deal.product,
    price: deal.price,
    profit: deal.profit,
  };

  // Stamp the snapshot onto the booking so the order survives deal deletion.
  if (!booking.dealSnapshot || !booking.dealSnapshot.platform) {
    booking.dealSnapshot = snapshot;
    await booking.save();
  }

  await OrderStat.updateOne(
    { booking: booking._id },
    {
      $setOnInsert: {
        booking: booking._id,
        platform: deal.platform || booking.dealSnapshot?.platform || 'Unknown',
        product: deal.product || booking.dealSnapshot?.product || '',
        dealTitle: deal.title || booking.dealSnapshot?.title || '',
        price: deal.price ?? booking.dealSnapshot?.price ?? 0,
        profit: deal.profit ?? booking.dealSnapshot?.profit ?? 0,
        cardHolder: holder._id || booking.cardHolder,
        cardHolderName: holder.name || '',
        cardHolderUsername: holder.username || '',
        booker: booker._id || booking.booker,
        bookerName: booker.name || '',
        cardBank: card.bank || '',
        cardLast4: card.last4 || '',
        completedAt: booking.completedAt || new Date(),
      },
    },
    { upsert: true }
  );
}

module.exports = { archiveCompletedOrder };

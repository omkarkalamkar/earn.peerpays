const mongoose = require('mongoose');

/**
 * Append-only archive of every COMPLETED order.
 *
 * This is the source of truth for ALL-TIME analytics. It is written once when an
 * order completes and is NEVER removed when an admin deletes the underlying booking
 * or the deal. That way the historical "hisab" (total orders, per-platform totals,
 * profit paid, etc.) is preserved even after cleanup.
 */
const orderStatSchema = new mongoose.Schema(
  {
    // Reference to the originating booking (unique -> prevents double counting).
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', unique: true, sparse: true },

    // Snapshot of the deal (kept even if the deal is later deleted).
    platform: { type: String, index: true },
    product: { type: String },
    dealTitle: { type: String },
    price: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },

    // Snapshot of the people involved.
    cardHolder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cardHolderName: { type: String },
    cardHolderUsername: { type: String },
    booker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookerName: { type: String },

    // Snapshot of the card used.
    cardBank: { type: String },
    cardLast4: { type: String },

    completedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OrderStat', orderStatSchema);

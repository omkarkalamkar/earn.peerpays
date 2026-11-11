const mongoose = require('mongoose');

/**
 * Booking status machine:
 * SUBMITTED     -> card holder submitted a card to a deal (waiting for a booker)
 * ACCEPTED      -> booker checked the offer and accepted; waiting for card holder to confirm
 * CONFIRMED     -> card holder confirmed the acceptance; booker can now proceed to OTP
 * OTP_REQUESTED -> booker is ready to place the order and requests OTP
 * OTP_APPROVED  -> card holder clicked "Go ahead"
 * OTP_SUBMITTED -> card holder entered the OTP; it is now visible to the booker (live)
 * COMPLETED     -> booker placed the order and uploaded the screenshot proof
 * REJECTED      -> booker rejected the submission
 * CANCELLED     -> cancelled by card holder / admin
 */
const STATUSES = [
  'SUBMITTED',
  'ACCEPTED',
  'CONFIRMED',
  'OTP_REQUESTED',
  'OTP_APPROVED',
  'OTP_SUBMITTED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

const otpEntrySchema = new mongoose.Schema(
  {
    code: { type: String },
    enteredAt: { type: Date },
    kind: { type: String, enum: ['submitted', 'resend_requested'], default: 'submitted' },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
    cardHolder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    booker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    card: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    status: { type: String, enum: STATUSES, default: 'SUBMITTED' },

    // Live OTP relay
    otpCurrent: { type: String, default: null },
    otpHistory: [otpEntrySchema],
    resendCount: { type: Number, default: 0 },
    // When set, the order must be completed before this time or it auto-rejects (3-min OTP window).
    otpDeadline: { type: Date, default: null },

    // True when a booker rejected this card at the initial offer-check step (SUBMITTED).
    // Such a card cannot be re-submitted to the same deal.
    offerRejected: { type: Boolean, default: false },

    // Snapshot of the deal at completion time so the order survives (and stays
    // readable) even if the deal is later deleted.
    dealSnapshot: {
      title: { type: String },
      platform: { type: String },
      product: { type: String },
      price: { type: Number },
      profit: { type: Number },
    },

    // Commission structure at time of booking completion
    commissionSnapshot: {
      bookerTotal: { type: Number, default: 0 },
      adminShare: { type: Number, default: 0 },
      cardholderShare: { type: Number, default: 0 },
    },

    // Order proof
    screenshotUrl: { type: String, default: '' },
    orderNote: { type: String, default: '' },

    // Ledger entries created for this booking
    cardholderLedger: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger', default: null },
    bookerLedger: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger', default: null },
    adminLedger: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger', default: null },

    acceptedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.STATUSES = STATUSES;

const mongoose = require('mongoose');

/**
 * Payment tracks actual payments made to card holders and bookers.
 * This is used for reconciliation: admin records when they've paid a card holder,
 * and the payment is subtracted from the ledger due amount.
 *
 * Type can be:
 * - 'cardholder_payout': payment given to card holder
 * - 'booker_payout': payment given to booker
 */

const paymentSchema = new mongoose.Schema(
  {
    // Who received this payment
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Type of payment
    type: {
      type: String,
      enum: ['cardholder_payout', 'booker_payout'],
      required: true,
    },

    // Amount paid
    amount: { type: Number, required: true, min: 0 },

    // Reference to the admin who recorded the payment
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Payment method (e.g., 'bank_transfer', 'cash', 'check')
    paymentMethod: { type: String, default: 'bank_transfer' },

    // Transaction reference ID (bank transfer ID, check number, etc.)
    referenceId: { type: String, default: '' },

    // Payment status
    status: {
      type: String,
      enum: ['pending', 'completed', 'reversed'],
      default: 'completed',
    },

    // Notes from admin about this payment
    notes: { type: String, default: '' },

    // Date when payment was actually made (may differ from createdAt)
    paidAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Index for quick lookups
paymentSchema.index({ recipient: 1, createdAt: -1 });
paymentSchema.index({ type: 1, recipient: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);

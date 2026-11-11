const mongoose = require('mongoose');

/**
 * Ledger tracks financial transactions for:
 * - Card holders: amounts earned from completed bookings
 * - Bookers: transaction amounts and their share of commissions
 * - Admin: earnings from commissions taken from bookers
 *
 * Type can be:
 * - 'cardholder_earning': card holder earns money from completed booking
 * - 'booker_transaction': booker's transaction ledger entry
 * - 'admin_earning': admin's earnings from booker commissions
 */

const ledgerSchema = new mongoose.Schema(
  {
    // Who this ledger entry is for
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Type of ledger entry
    type: {
      type: String,
      enum: ['cardholder_earning', 'booker_transaction', 'admin_earning'],
      required: true,
    },

    // Reference to the booking that generated this ledger entry
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },

    // Reference to the deal
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', default: null },

    // Transaction details
    description: { type: String, required: true },

    // For cardholder: order amount + cardholder commission
    // For booker: order amount + booker commission
    // For admin: admin commission from booker
    amount: { type: Number, required: true, min: 0 },

    // Commission breakdown (visible to relevant users)
    commission: {
      total: { type: Number, default: 0, min: 0 }, // Total commission from booker
      adminShare: { type: Number, default: 0, min: 0 }, // Admin's cut
      cardholderShare: { type: Number, default: 0, min: 0 }, // Card holder's cut (may be part of total or from deal.profit)
      bookerShare: { type: Number, default: 0, min: 0 }, // Booker's commission
    },

    // Status of this ledger entry
    status: {
      type: String,
      enum: ['pending', 'confirmed'],
      default: 'confirmed',
    },

    // Metadata
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Index for quick lookups
ledgerSchema.index({ user: 1, createdAt: -1 });
ledgerSchema.index({ booking: 1 });
ledgerSchema.index({ deal: 1 });
ledgerSchema.index({ type: 1, user: 1 });

module.exports = mongoose.model('Ledger', ledgerSchema);

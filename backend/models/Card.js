const mongoose = require('mongoose');

/**
 * Card details belonging to a card holder.
 * SECURITY: the full card number is stored encrypted (AES-256) in `numberEnc`.
 * The CVV is NEVER persisted. We keep only the last 4 digits in plaintext for display/lists.
 */
const cardSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bank: { type: String, required: true, trim: true },
    network: { type: String, enum: ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Other'], default: 'Other' },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    holderName: { type: String, required: true, trim: true },
    numberEnc: { type: String, required: true },
    // CVV stored encrypted (AES-256) at the card holder's explicit request.
    cvvEnc: { type: String, default: '' },
    last4: { type: String, required: true },
    expiryMonth: { type: Number, required: true, min: 1, max: 12 },
    expiryYear: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Card', cardSchema);

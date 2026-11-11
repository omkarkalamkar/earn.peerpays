const mongoose = require('mongoose');

const PLATFORMS = ['Amazon', 'Flipkart'];

const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    product: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    profit: { type: Number, default: 0, min: 0 },
    offerDetails: { type: String, default: '' },
    eligibleBanks: [{ type: String, trim: true }],
    eligibleCardTypes: [{ type: String, enum: ['credit', 'debit'] }],
    imageUrl: { type: String, default: '' },
    // open   -> live/visible to card holders & bookers
    // closed -> paused (not live) but still a normal deal
    // expired-> soft-deleted; hidden from everyone except admin, can be hard-deleted later
    status: { type: String, enum: ['open', 'closed', 'expired'], default: 'open' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Commission structure for this deal
    // Example: booker pays 1500 total commission
    //          admin keeps 500, cardholder gets 1000
    commission: {
      bookerTotal: { type: Number, default: 0, min: 0 }, // Total commission from booker
      adminShare: { type: Number, default: 0, min: 0 }, // Admin's cut from booker commission
      cardholderShare: { type: Number, default: 0, min: 0 }, // Cardholder's cut from booker commission
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Deal', dealSchema);
module.exports.PLATFORMS = PLATFORMS;

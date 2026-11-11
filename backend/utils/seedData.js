const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Deal = require('../models/Deal');

/**
 * Ensures a baseline dataset exists.
 * - Always ensures an admin account (from env).
 * - If `withDemo` is true and the DB has no card holders/bookers yet, creates demo users + deals.
 * Safe to run repeatedly (idempotent on usernames).
 */
async function seedData({ withDemo = false } = {}) {
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  let admin = await User.findOne({ username: adminUsername });
  if (!admin) {
    admin = await User.create({
      username: adminUsername,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'admin',
      name: process.env.ADMIN_NAME || 'Administrator',
    });
    console.log(`[seed] Created admin "${adminUsername}" / "${adminPassword}"`);
  }

  if (!withDemo) return { admin };

  const holderCount = await User.countDocuments({ role: { $in: ['cardholder', 'booker'] } });
  if (holderCount > 0) return { admin };

  const holder = await User.create({
    username: 'holder1',
    passwordHash: await bcrypt.hash('holder123', 10),
    role: 'cardholder',
    name: 'Ravi Kumar',
    phone: '9000000001',
  });
  const booker = await User.create({
    username: 'booker1',
    passwordHash: await bcrypt.hash('booker123', 10),
    role: 'booker',
    name: 'Priya Shah',
    phone: '9000000002',
  });

  await Deal.create([
    {
      title: 'iPhone 15 - Amazon Bank Offer',
      platform: 'Amazon',
      product: 'Apple iPhone 15 (128GB)',
      price: 65999,
      profit: 1500,
      offerDetails: '10% instant discount up to Rs 6000 on HDFC/ICICI credit cards.',
      eligibleBanks: ['HDFC', 'ICICI'],
      eligibleCardTypes: ['credit'],
      commission: {
        bookerTotal: 1500,
        adminShare: 800,
        cardholderShare: 700,
      },
      createdBy: admin._id,
    },
    {
      title: 'Samsung S24 - Flipkart Offer',
      platform: 'Flipkart',
      product: 'Samsung Galaxy S24 (256GB)',
      price: 74999,
      profit: 2000,
      offerDetails: '12% off up to Rs 7000 on SBI/Axis cards.',
      eligibleBanks: ['SBI', 'Axis'],
      eligibleCardTypes: ['credit', 'debit'],
      commission: {
        bookerTotal: 2000,
        adminShare: 1200,
        cardholderShare: 800,
      },
      createdBy: admin._id,
    },
  ]);

  console.log('[seed] Created demo users: holder1/holder123, booker1/booker123 and 2 deals');
  return { admin, holder, booker };
}

module.exports = { seedData };

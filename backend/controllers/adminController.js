const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Booking = require('../models/Booking');
const OrderStat = require('../models/OrderStat');
const { emitToAdmins } = require('../utils/socket');

/** Create a card holder or booker account (admin only). */
async function createUser(req, res) {
  const { username, password, name, role, phone } = req.body;
  if (!username || !password || !name || !role) {
    return res.status(400).json({ message: 'username, password, name and role are required' });
  }
  if (!['cardholder', 'booker'].includes(role)) {
    return res.status(400).json({ message: 'role must be cardholder or booker' });
  }

  const exists = await User.findOne({ username: String(username).toLowerCase() });
  if (exists) return res.status(409).json({ message: 'Username already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username: String(username).toLowerCase(),
    passwordHash,
    name,
    role,
    phone,
  });
  res.status(201).json({ user });
}

/** List all users (optionally filter by role). Hidden 'viewer' accounts are never returned. */
async function listUsers(req, res) {
  const filter = {};
  if (req.query.role && req.query.role !== 'viewer') {
    filter.role = req.query.role;
  } else {
    // Never expose the anonymous read-only viewer account(s) to anyone.
    filter.role = { $ne: 'viewer' };
  }
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json({ users });
}

async function setUserActive(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ message: 'Cannot modify admin' });
  user.active = Boolean(req.body.active);
  await user.save();
  res.json({ user });
}

/** All completed (confirmed) orders. */
async function confirmedOrders(req, res) {
  const bookings = await Booking.find({ status: 'COMPLETED' })
    .populate('deal')
    .populate('cardHolder', 'name username phone')
    .populate('booker', 'name username')
    .populate('card', 'bank network type last4')
    .sort({ completedAt: -1 })
    .lean();

  // If a deal was deleted after the order completed, fall back to the snapshot
  // stored on the booking so the product/platform/price still display.
  bookings.forEach((b) => {
    if (!b.deal && b.dealSnapshot) b.deal = b.dealSnapshot;
  });

  res.json({ bookings });
}

/** Card holders that have at least one confirmed order, with counts. */
async function cardHoldersWithOrders(req, res) {
  const rows = await Booking.aggregate([
    { $match: { status: 'COMPLETED' } },
    {
      $group: {
        _id: '$cardHolder',
        orderCount: { $sum: 1 },
        lastOrderAt: { $max: '$completedAt' },
      },
    },
    {
      $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        orderCount: 1,
        lastOrderAt: 1,
        'user.name': 1,
        'user.username': 1,
        'user.phone': 1,
      },
    },
    { $sort: { orderCount: -1 } },
  ]);
  res.json({ cardHolders: rows });
}

/**
 * All-time analytics, sourced from the append-only OrderStat archive so numbers
 * are preserved even after bookings/deals are deleted. Also returns the current
 * live pipeline (active bookings) sourced from the Booking collection.
 */
async function analytics(req, res) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const since30 = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);

  const [totalsAgg, byPlatform, todayAgg, monthAgg, dailyAgg, topHolders, topBookers, pipelineAgg] =
    await Promise.all([
      OrderStat.aggregate([
        { $group: { _id: null, orders: { $sum: 1 }, value: { $sum: '$price' }, profit: { $sum: '$profit' } } },
      ]),
      OrderStat.aggregate([
        {
          $group: {
            _id: { $ifNull: ['$platform', 'Unknown'] },
            orders: { $sum: 1 },
            value: { $sum: '$price' },
            profit: { $sum: '$profit' },
          },
        },
        { $sort: { orders: -1 } },
      ]),
      OrderStat.aggregate([
        { $match: { completedAt: { $gte: startOfToday } } },
        { $group: { _id: null, orders: { $sum: 1 }, value: { $sum: '$price' }, profit: { $sum: '$profit' } } },
      ]),
      OrderStat.aggregate([
        { $match: { completedAt: { $gte: startOfMonth } } },
        { $group: { _id: null, orders: { $sum: 1 }, value: { $sum: '$price' }, profit: { $sum: '$profit' } } },
      ]),
      OrderStat.aggregate([
        { $match: { completedAt: { $gte: since30 } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
            orders: { $sum: 1 },
            value: { $sum: '$price' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      OrderStat.aggregate([
        {
          $group: {
            _id: '$cardHolder',
            name: { $first: '$cardHolderName' },
            username: { $first: '$cardHolderUsername' },
            orders: { $sum: 1 },
            profit: { $sum: '$profit' },
          },
        },
        { $sort: { orders: -1 } },
        { $limit: 5 },
      ]),
      OrderStat.aggregate([
        {
          $group: {
            _id: '$booker',
            name: { $first: '$bookerName' },
            orders: { $sum: 1 },
            value: { $sum: '$price' },
          },
        },
        { $sort: { orders: -1 } },
        { $limit: 5 },
      ]),
      Booking.aggregate([
        { $match: { status: { $in: ['SUBMITTED', 'ACCEPTED', 'CONFIRMED', 'OTP_REQUESTED', 'OTP_APPROVED', 'OTP_SUBMITTED'] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

  const totals = totalsAgg[0] || { orders: 0, value: 0, profit: 0 };
  const today = todayAgg[0] || { orders: 0, value: 0, profit: 0 };
  const month = monthAgg[0] || { orders: 0, value: 0, profit: 0 };

  const pipeline = pipelineAgg.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});
  const activeTotal = pipelineAgg.reduce((s, r) => s + r.count, 0);

  res.json({
    totals: { orders: totals.orders, value: totals.value, profit: totals.profit },
    today: { orders: today.orders, value: today.value, profit: today.profit },
    month: { orders: month.orders, value: month.value, profit: month.profit },
    byPlatform: byPlatform.map((p) => ({ platform: p._id, orders: p.orders, value: p.value, profit: p.profit })),
    daily: dailyAgg.map((d) => ({ date: d._id, orders: d.orders, value: d.value })),
    topHolders: topHolders.map((h) => ({ id: h._id, name: h.name, username: h.username, orders: h.orders, profit: h.profit })),
    topBookers: topBookers.map((b) => ({ id: b._id, name: b.name, orders: b.orders, value: b.value })),
    pipeline: { byStatus: pipeline, total: activeTotal },
  });
}

/** Permanently delete a specific order (booking). Admin only. */
async function deleteOrder(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Order not found' });

  // Remove the stored screenshot file, if any (best-effort).
  if (booking.screenshotUrl) {
    const rel = booking.screenshotUrl.replace(/^\/+/, '');
    const filePath = path.join(__dirname, '..', rel);
    fs.unlink(filePath, () => {});
  }

  await Booking.deleteOne({ _id: booking._id });
  emitToAdmins('order:deleted', { bookingId: String(booking._id) });
  res.json({ ok: true, bookingId: String(booking._id) });
}

module.exports = {
  createUser,
  listUsers,
  setUserActive,
  confirmedOrders,
  cardHoldersWithOrders,
  analytics,
  deleteOrder,
};

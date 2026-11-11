const Ledger = require('../models/Ledger');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const User = require('../models/User');

/**
 * Get current user's ledger entries
 */
async function getMyLedger(req, res) {
  const entries = await Ledger.find({ user: req.user._id })
    .populate('booking', 'dealSnapshot status completedAt')
    .populate('deal', 'title platform')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json(entries);
}

/**
 * Get current user's total amount due
 * For card holders: sum of all earnings minus payments
 * For bookers: sum of all transaction amounts
 * For admin: not applicable, but can query others
 */
async function getMyDue(req, res) {
  const user = req.user;

  // Get all ledger entries for this user
  const entries = await Ledger.find({ user: user._id });
  const totalEarnings = entries.reduce((sum, e) => sum + e.amount, 0);

  // Get all payments made to this user
  const payments = await Payment.find({
    recipient: user._id,
    status: { $in: ['completed', 'pending'] },
  });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const due = totalEarnings - totalPaid;

  res.json({
    userId: user._id,
    userRole: user.role,
    totalEarnings,
    totalPaid,
    due, // Allow negative values (advance payments)
    currency: 'INR',
  });
}

/**
 * Get current user's stats (number of orders, number of deals, etc.)
 */
async function getMyStats(req, res) {
  const user = req.user;
  let stats = {
    userId: user._id,
    userRole: user.role,
    totalTransactions: 0,
    totalEarnings: 0,
    totalPaid: 0,
  };

  if (user.role === 'cardholder') {
    // Count completed bookings
    const completedBookings = await Booking.countDocuments({
      cardHolder: user._id,
      status: 'COMPLETED',
    });

    // Get total amount (order + commission) - what admin will pay them
    const earnings = await Ledger.aggregate([
      { $match: { user: user._id, type: 'cardholder_earning' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // Get total paid
    const payments = await Payment.aggregate([
      { $match: { recipient: user._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    stats.totalTransactions = completedBookings;
    stats.totalEarnings = earnings[0]?.total || 0;
    stats.totalPaid = payments[0]?.total || 0;
    stats.due = stats.totalEarnings - stats.totalPaid;
  } else if (user.role === 'booker') {
    // Count completed bookings
    const completedBookings = await Booking.countDocuments({
      booker: user._id,
      status: 'COMPLETED',
    });

    // Get total transaction amount from ledger
    const transactions = await Ledger.aggregate([
      { $match: { user: user._id, type: 'booker_transaction' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    stats.totalTransactions = completedBookings;
    stats.totalEarnings = transactions[0]?.total || 0;
  }

  res.json(stats);
}

/**
 * Get card holder's ledger (admin only)
 */
async function getCardholderLedger(req, res) {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user || user.role !== 'cardholder') {
    return res.status(404).json({ message: 'Card holder not found' });
  }

  const entries = await Ledger.find({ user: id })
    .populate('booking', 'dealSnapshot status completedAt')
    .populate('deal', 'title platform')
    .sort({ createdAt: -1 });

  res.json(entries);
}

/**
 * Get card holder's total due (admin only)
 */
async function getCardholderDue(req, res) {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user || user.role !== 'cardholder') {
    return res.status(404).json({ message: 'Card holder not found' });
  }

  const entries = await Ledger.find({ user: id, type: 'cardholder_earning' });
  // Total earnings = full ledger amount (order price + commission)
  const totalEarnings = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

  const payments = await Payment.find({
    recipient: id,
    status: { $in: ['completed', 'pending'] },
  });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  // Allow negative balance (overpaid)
  const due = totalEarnings - totalPaid;

  res.json({
    userId: id,
    userName: user.name,
    userUsername: user.username,
    totalTransactions: entries.length,
    totalEarnings,
    totalPaid,
    due, // Can be negative
    currency: 'INR',
  });
}

/**
 * Get card holder's stats (admin only)
 */
async function getCardholderStats(req, res) {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user || user.role !== 'cardholder') {
    return res.status(404).json({ message: 'Card holder not found' });
  }

  const completedBookings = await Booking.countDocuments({
    cardHolder: id,
    status: 'COMPLETED',
  });

  const earnings = await Ledger.aggregate([
    { $match: { user: id, type: 'cardholder_earning' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const payments = await Payment.aggregate([
    { $match: { recipient: id, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.json({
    userId: id,
    userName: user.name,
    userUsername: user.username,
    totalTransactions: completedBookings,
    totalEarnings: earnings[0]?.total || 0,
    totalPaid: payments[0]?.total || 0,
    due: Math.max(0, (earnings[0]?.total || 0) - (payments[0]?.total || 0)),
  });
}

/**
 * Get booker's ledger (admin only)
 */
async function getBookerLedger(req, res) {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user || user.role !== 'booker') {
    return res.status(404).json({ message: 'Booker not found' });
  }

  const entries = await Ledger.find({ user: id })
    .populate('booking', 'dealSnapshot status completedAt')
    .populate('deal', 'title platform')
    .sort({ createdAt: -1 });

  res.json(entries);
}

/**
 * Get booker's due amount (admin only)
 */
async function getBookerDue(req, res) {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user || user.role !== 'booker') {
    return res.status(404).json({ message: 'Booker not found' });
  }

  const entries = await Ledger.find({ user: id, type: 'booker_transaction' });
  const totalEarnings = entries.reduce((sum, e) => sum + e.amount, 0);

  const payments = await Payment.find({
    recipient: id,
    status: { $in: ['completed', 'pending'] },
  });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  // Allow negative balance (overpaid)
  const due = totalEarnings - totalPaid;

  res.json({
    userId: id,
    userName: user.name,
    userUsername: user.username,
    totalTransactions: entries.length,
    totalEarnings,
    totalPaid,
    due, // Can be negative
    currency: 'INR',
  });
}

/**
 * Get booker's stats (admin only)
 */
async function getBookerStats(req, res) {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user || user.role !== 'booker') {
    return res.status(404).json({ message: 'Booker not found' });
  }

  const completedBookings = await Booking.countDocuments({
    booker: id,
    status: 'COMPLETED',
  });

  const transactions = await Ledger.aggregate([
    { $match: { user: id, type: 'booker_transaction' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const payments = await Payment.aggregate([
    { $match: { recipient: id, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.json({
    userId: id,
    userName: user.name,
    userUsername: user.username,
    totalTransactions: completedBookings,
    totalAmount: transactions[0]?.total || 0,
    totalPaid: payments[0]?.total || 0,
    due: Math.max(0, (transactions[0]?.total || 0) - (payments[0]?.total || 0)),
  });
}

/**
 * Get all ledgers across all users (admin only)
 */
async function getAllLedgers(req, res) {
  const { userRole, limit = 500 } = req.query;

  let filter = {};
  if (userRole) filter.type = userRole === 'cardholder' ? 'cardholder_earning' : `${userRole}_transaction`;

  const ledgers = await Ledger.find(filter)
    .populate('user', 'name username role')
    .populate('booking', 'dealSnapshot status completedAt')
    .populate('deal', 'title platform')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) || 500);

  res.json(ledgers);
}

/**
 * Get admin's earnings from all booker commissions (admin only)
 */
async function getAdminEarnings(req, res) {
  // Get all admin commission earnings from bookings
  const adminLedgers = await Ledger.find({ type: 'admin_earning' });
  const totalEarnings = adminLedgers.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Get all payments made to cardholders
  const cardholderPayments = await Payment.find({
    type: 'cardholder_payout',
    status: 'completed',
  });
  const totalCardholderPaid = cardholderPayments.reduce((sum, p) => sum + p.amount, 0);

  // Get all payments received from bookers
  const bookerPayments = await Payment.find({
    type: 'booker_payment',
    status: 'completed',
  });
  const totalBookerReceived = bookerPayments.reduce((sum, p) => sum + p.amount, 0);

  res.json({
    totalEarnings,
    totalCardholderPaid,
    totalBookerReceived,
    netProfit: totalEarnings,
    due: totalEarnings,
    count: adminLedgers.length,
    currency: 'INR',
  });
}

/**
 * Record a payment to a card holder (admin only)
 */
async function recordCardholderPayment(req, res) {
  const { recipientId, amount, paymentMethod = 'bank_transfer', referenceId = '', notes = '' } = req.body;

  if (!recipientId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid recipientId or amount' });
  }

  const recipient = await User.findById(recipientId);
  if (!recipient || recipient.role !== 'cardholder') {
    return res.status(404).json({ message: 'Card holder not found' });
  }

  const payment = new Payment({
    recipient: recipientId,
    type: 'cardholder_payout',
    amount,
    recordedBy: req.user._id,
    paymentMethod,
    referenceId,
    notes,
    status: 'completed',
  });

  await payment.save();

  res.status(201).json(payment);
}

/**
 * Record a payment to a booker (admin only)
 */
async function recordBookerPayment(req, res) {
  const { recipientId, amount, paymentMethod = 'bank_transfer', referenceId = '', notes = '' } = req.body;

  if (!recipientId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid recipientId or amount' });
  }

  const recipient = await User.findById(recipientId);
  if (!recipient || recipient.role !== 'booker') {
    return res.status(404).json({ message: 'Booker not found' });
  }

  const payment = new Payment({
    recipient: recipientId,
    type: 'booker_payout',
    amount,
    recordedBy: req.user._id,
    paymentMethod,
    referenceId,
    notes,
    status: 'completed',
  });

  await payment.save();

  res.status(201).json(payment);
}

/**
 * List all payments (admin only)
 */
async function listPayments(req, res) {
  const { type, status, recipientId, limit = 100 } = req.query;

  let filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (recipientId) filter.recipient = recipientId;

  const payments = await Payment.find(filter)
    .populate('recipient', 'name username role')
    .populate('recordedBy', 'name username')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) || 100);

  res.json(payments);
}

/**
 * Update payment status (admin only)
 */
async function updatePaymentStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'completed', 'reversed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const payment = await Payment.findByIdAndUpdate(id, { status }, { new: true }).populate('recipient', 'name username');

  if (!payment) return res.status(404).json({ message: 'Payment not found' });

  res.json(payment);
}

module.exports = {
  getMyLedger,
  getMyDue,
  getMyStats,
  getCardholderLedger,
  getCardholderDue,
  getCardholderStats,
  getBookerLedger,
  getBookerDue,
  getBookerStats,
  getAllLedgers,
  getAdminEarnings,
  recordCardholderPayment,
  recordBookerPayment,
  listPayments,
  updatePaymentStatus,
};

/**
 * Get my payments (for authenticated users - cardholders & bookers)
 */
async function getMyPayments(req, res) {
  const userId = req.user._id;
  
  const payments = await Payment.find({
    recipient: userId,
    status: { $in: ['completed', 'pending'] }
  })
    .populate('recordedBy', 'name username')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json(payments);
}

module.exports.getMyPayments = getMyPayments;

/**
 * Delete a ledger entry (admin only)
 */
async function deleteLedgerEntry(req, res) {
  const { id } = req.params;
  
  const entry = await Ledger.findById(id);
  if (!entry) {
    return res.status(404).json({ message: 'Ledger entry not found' });
  }
  
  await Ledger.findByIdAndDelete(id);
  res.json({ message: 'Ledger entry deleted successfully' });
}

/**
 * Delete a payment entry (admin only)
 */
async function deletePayment(req, res) {
  const { id } = req.params;
  
  const payment = await Payment.findById(id);
  if (!payment) {
    return res.status(404).json({ message: 'Payment not found' });
  }
  
  await Payment.findByIdAndDelete(id);
  res.json({ message: 'Payment deleted successfully' });
}

module.exports.deleteLedgerEntry = deleteLedgerEntry;
module.exports.deletePayment = deletePayment;

/**
 * Manually add a ledger entry (admin only)
 * For manual orders/adjustments
 */
async function addManualLedgerEntry(req, res) {
  const { userId, type, amount, description, notes } = req.body;

  if (!userId || !type || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid userId, type, or amount' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Validate type based on user role
  if (user.role === 'cardholder' && type !== 'cardholder_earning') {
    return res.status(400).json({ message: 'Invalid type for cardholder' });
  }
  if (user.role === 'booker' && type !== 'booker_transaction') {
    return res.status(400).json({ message: 'Invalid type for booker' });
  }

  const ledgerEntry = new Ledger({
    user: userId,
    type,
    amount: parseFloat(amount),
    description: description || 'Manual entry',
    notes: notes || '',
    status: 'confirmed',
    commission: {
      total: 0,
      adminShare: 0,
      cardholderShare: 0,
    },
  });

  await ledgerEntry.save();

  res.status(201).json({
    message: 'Ledger entry added successfully',
    entry: ledgerEntry,
  });
}

module.exports.addManualLedgerEntry = addManualLedgerEntry;

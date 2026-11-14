const Deal = require('../models/Deal');
const User = require('../models/User');
const { emitToBookers } = require('../utils/socket');
const { notify } = require('../utils/notify');

/** Public-ish: any authenticated user can view open deals. Admin/viewer see all. */
async function listDeals(req, res) {
  const filter = {};
  if (!['admin', 'viewer'].includes(req.user.role)) {
    filter.status = 'open';
    
    // For bookers: filter by assigned booker and quantity limits
    if (req.user.role === 'booker') {
      filter.$and = [
        {
          $or: [
            { assignedBooker: null }, // Available to all bookers
            { assignedBooker: req.user._id }, // Assigned to this booker
          ],
        },
        {
          $or: [
            { quantity: -1 }, // Unlimited
            { $expr: { $lt: ['$completedCount', '$quantity'] } }, // Still has quota
          ],
        },
      ];
    }
  }
  
  const deals = await Deal.find(filter).sort({ createdAt: -1 }).populate('assignedBooker', 'name username');
  res.json({ deals });
}

async function getDeal(req, res) {
  const deal = await Deal.findById(req.params.id);
  if (!deal) return res.status(404).json({ message: 'Deal not found' });
  res.json({ deal });
}

async function createDeal(req, res) {
  const {
    title,
    platform,
    product,
    price,
    profit,
    offerDetails,
    eligibleBanks,
    eligibleCardTypes,
    imageUrl,
    assignedBooker,
    quantity,
    commission = {},
  } = req.body;

  if (!title || !platform || !product || price == null) {
    return res.status(400).json({ message: 'title, platform, product and price are required' });
  }

  // Validate commission structure
  const bookerTotal = commission.bookerTotal || 0;
  const adminShare = commission.adminShare || 0;
  const cardholderShare = commission.cardholderShare || 0;

  if (adminShare + cardholderShare > bookerTotal) {
    return res.status(400).json({
      message: 'Admin share + cardholder share cannot exceed booker total commission',
    });
  }

  const deal = await Deal.create({
    title,
    platform,
    product,
    price,
    profit: profit || 0,
    offerDetails,
    eligibleBanks: eligibleBanks || [],
    eligibleCardTypes: eligibleCardTypes || [],
    imageUrl: imageUrl || '',
    assignedBooker: assignedBooker || null,
    quantity: quantity != null ? quantity : -1,
    completedCount: 0,
    commission: {
      bookerTotal,
      adminShare,
      cardholderShare,
    },
    createdBy: req.user._id,
  });

  emitToBookers('deal:new', deal);

  // Notify all cardholders about the new deal
  const cardholders = await User.find({ role: 'cardholder', active: true });
  const notificationPromises = cardholders.map((cardholder) =>
    notify(cardholder._id, 'DEAL_POSTED', `New deal posted: ${title}`, deal._id)
  );
  await Promise.all(notificationPromises);

  res.status(201).json({ deal });
}

async function updateDeal(req, res) {
  const deal = await Deal.findById(req.params.id);
  if (!deal) return res.status(404).json({ message: 'Deal not found' });

  const fields = [
    'title',
    'platform',
    'product',
    'price',
    'profit',
    'offerDetails',
    'eligibleBanks',
    'eligibleCardTypes',
    'imageUrl',
    'status',
    'assignedBooker',
    'quantity',
  ];

  fields.forEach((f) => {
    if (req.body[f] !== undefined) deal[f] = req.body[f];
  });

  // Handle commission structure update
  if (req.body.commission) {
    const bookerTotal = req.body.commission.bookerTotal || 0;
    const adminShare = req.body.commission.adminShare || 0;
    const cardholderShare = req.body.commission.cardholderShare || 0;

    if (adminShare + cardholderShare > bookerTotal) {
      return res.status(400).json({
        message: 'Admin share + cardholder share cannot exceed booker total commission',
      });
    }

    deal.commission = {
      bookerTotal,
      adminShare,
      cardholderShare,
    };
  }

  await deal.save();
  res.json({ deal });
}

async function deleteDeal(req, res) {
  const deal = await Deal.findById(req.params.id);
  if (!deal) return res.status(404).json({ message: 'Deal not found' });
  // Enforce the soft-delete flow: a deal must be expired before it can be permanently removed.
  if (deal.status !== 'expired') {
    return res.status(400).json({ message: 'Expire the deal first, then delete it.' });
  }
  await Deal.deleteOne({ _id: deal._id });
  res.json({ ok: true });
}

module.exports = { listDeals, getDeal, createDeal, updateDeal, deleteDeal };

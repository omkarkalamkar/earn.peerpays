const Booking = require('../models/Booking');
const Deal = require('../models/Deal');
const Card = require('../models/Card');
const User = require('../models/User');
const Ledger = require('../models/Ledger');
const { decrypt } = require('../utils/crypto');
const { notify } = require('../utils/notify');
const { emitToUser, emitToBooking, emitToBookers, emitToAdmins } = require('../utils/socket');
const { archiveCompletedOrder } = require('../utils/orderStats');

/** OTP window: the order must be completed within this time after OTP is sent, else auto-reject. */
const OTP_WINDOW_MS = 3 * 60 * 1000;

async function populated(id) {
  return Booking.findById(id)
    .populate('deal')
    .populate('cardHolder', 'name username phone anonymousCode')
    .populate('booker', 'name username')
    .populate('card', 'bank network type holderName last4 expiryMonth expiryYear');
}

function serialize(booking) {
  const b = booking.toObject ? booking.toObject() : booking;
  
  // Handle saved card (has reference)
  if (b.card) {
    b.card.masked = `**** **** **** ${b.card.last4}`;
  }
  
  // Handle temporary card (inline cardData)
  if (b.cardData && b.cardData.number) {
    // Create last4 from number
    const cleanNumber = b.cardData.number.replace(/\s/g, '');
    const last4 = cleanNumber.slice(-4);
    
    // Create a card-like object for booker to see
    b.card = {
      bank: b.cardData.bank,
      network: b.cardData.network,
      type: b.cardData.type,
      holderName: b.cardData.holderName,
      cardName: b.cardData.cardName, // Keep cardName for cardholder
      last4: last4,
      expiryMonth: b.cardData.expiryMonth,
      expiryYear: b.cardData.expiryYear,
      masked: `**** **** **** ${last4}`,
      temporary: true,
    };
    
    // Don't expose full card number in response
    delete b.cardData.number;
  }
  
  return b;
}

/** Card holders must never see the order screenshot proof - that is admin/booker only. */
function serializeForHolder(booking) {
  const b = serialize(booking);
  delete b.screenshotUrl;
  // Card holders must not see the booker's personal identity - only an anonymous reference.
  const bookerId = String((b.booker && (b.booker._id || b.booker)) || '');
  b.bookerRef = bookerId ? `BK-${bookerId.slice(-5).toUpperCase()}` : null;
  delete b.booker;
  return b;
}

/**
 * Bookers must NOT see the card holder's personal identity (name / username / phone).
 * They get an anonymous reference code instead. The name printed on the card is only
 * revealed via the dedicated /card endpoint at payment time (functionally required there).
 */
function serializeForBooker(booking) {
  const b = serialize(booking);
  const holderId = String((b.cardHolder && (b.cardHolder._id || b.cardHolder)) || '');
  const bookingId = String(b._id || '');
  b.holderRef = holderId ? `CH-${holderId.slice(-5).toUpperCase()}` : 'CH-?????';
  b.ref = bookingId ? bookingId.slice(-6).toUpperCase() : '';
  
  // Show anonymous code instead of real name/username
  b.holderDisplayName = (b.cardHolder && b.cardHolder.anonymousCode) || `C-${holderId.slice(-4).toUpperCase()}`;
  b.holderUsername = (b.cardHolder && b.cardHolder.username) || null;
  delete b.cardHolder;
  
  // Hide card holder's real name, use anonymous code
  if (b.card && b.card.holderName) {
    b.card.holderName = b.holderDisplayName;
  }
  // Also hide cardName (it's personal to cardholder)
  if (b.card && b.card.cardName) {
    delete b.card.cardName;
  }
  
  return b;
}

/** Broadcast a booking update to the card holder and the booker (identity-scoped each). */
function broadcast(booking) {
  emitToUser(String(booking.cardHolder._id || booking.cardHolder), 'booking:update', serializeForHolder(booking));
  if (booking.booker) {
    emitToUser(String(booking.booker._id || booking.booker), 'booking:update', serializeForBooker(booking));
  }
}

/** Does a card satisfy a deal's bank + type eligibility? */
function cardEligible(card, deal) {
  const banks = deal.eligibleBanks || [];
  const types = deal.eligibleCardTypes || [];
  const bankOk =
    banks.length === 0 ||
    banks.some((b) => {
      const a = String(b).toLowerCase().trim();
      const c = String(card.bank).toLowerCase().trim();
      return a === c || c.includes(a) || a.includes(c);
    });
  const typeOk = types.length === 0 || types.includes(card.type);
  return bankOk && typeOk;
}

/**
 * Card holder submits one OR MANY cards to a deal.
 * Accepts `cardIds` (array) or a single `cardId`. One booking is created per card so
 * bookers can pick up / manage each card independently.
 * 
 * NEW: Also accepts `cardData` for direct card sharing without saving.
 */
async function submit(req, res) {
  const { dealId, cardData } = req.body;
  const cardIds = Array.isArray(req.body.cardIds)
    ? req.body.cardIds
    : req.body.cardId
    ? [req.body.cardId]
    : [];

  const deal = await Deal.findById(dealId);
  if (!deal || deal.status !== 'open') return res.status(400).json({ message: 'Deal not available' });
  
  // If cardData is provided, create temporary card (not saved to database)
  if (cardData) {
    // Validate card data
    if (!cardData.bank || !cardData.number || !cardData.expiryMonth || !cardData.expiryYear) {
      return res.status(400).json({ message: 'Incomplete card data' });
    }

    // Create temporary card object (not saved to DB)
    const tempCard = {
      bank: cardData.bank,
      network: cardData.network || 'Visa',
      type: cardData.type || 'credit',
      holderName: cardData.holderName || cardData.bank,
      number: cardData.number,
      cvv: cardData.cvv,
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
      owner: req.user._id,
      active: true,
      temporary: true, // Flag to indicate it's not saved
    };

    // Check eligibility
    if (!cardEligible(tempCard, deal)) {
      return res.status(400).json({ message: 'Card is not eligible for this deal' });
    }

    // Create booking with card data embedded (not referencing saved card)
    let booking = await Booking.create({
      deal: deal._id,
      cardHolder: req.user._id,
      cardData: tempCard, // Store card data inline
      status: 'SUBMITTED',
    });
    
    booking = await Booking.findById(booking._id)
      .populate('deal')
      .populate('cardHolder', 'name username phone anonymousCode');
    
    emitToBookers('booking:new', serializeForBooker(booking));
    
    // Notify all bookers
    const bookers = await User.find({ role: 'booker', active: true });
    const notificationPromises = bookers.map((booker) =>
      notify(
        booker._id,
        'CARD_SUBMITTED',
        `Card submitted for deal: ${deal.title}. Please transact quickly!`,
        booking._id
      )
    );
    await Promise.all(notificationPromises);

    return res.json({ bookings: [serializeForHolder(booking)], rejected: 0 });
  }

  // Original flow: using saved cards
  if (cardIds.length === 0) return res.status(400).json({ message: 'Select at least one card' });

  const cards = await Card.find({ _id: { $in: cardIds }, owner: req.user._id, active: true });
  if (cards.length === 0) return res.status(404).json({ message: 'Card not found' });

  const eligible = cards.filter((c) => cardEligible(c, deal));
  if (eligible.length === 0) {
    return res.status(400).json({ message: 'Selected card(s) are not eligible for this deal' });
  }

  const created = [];
  let skipped = 0;
  let rejected = 0;
  for (const card of eligible) {
    // If this card was rejected for this deal at the initial offer-check step, block re-submission.
    const priorOfferReject = await Booking.findOne({
      deal: deal._id,
      card: card._id,
      cardHolder: req.user._id,
      offerRejected: true,
    });
    if (priorOfferReject) {
      rejected += 1;
      continue;
    }
    // Don't create a duplicate active submission of the same card to the same deal.
    const existing = await Booking.findOne({
      deal: deal._id,
      card: card._id,
      cardHolder: req.user._id,
      status: { $nin: ['REJECTED', 'CANCELLED', 'COMPLETED'] },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    let booking = await Booking.create({
      deal: deal._id,
      cardHolder: req.user._id,
      card: card._id,
      status: 'SUBMITTED',
    });
    booking = await populated(booking._id);
    emitToBookers('booking:new', serializeForBooker(booking));
    created.push(serializeForHolder(booking));

    // Notify all bookers that a card has been submitted
    const bookers = await User.find({ role: 'booker', active: true });
    const notificationPromises = bookers.map((booker) =>
      notify(
        booker._id,
        'CARD_SUBMITTED',
        `Card submitted for deal: ${deal.title}. Please transact quickly!`,
        booking._id
      )
    );
    await Promise.all(notificationPromises);
  }

  if (created.length === 0) {
    if (rejected > 0) {
      return res.status(409).json({
        message: 'This card was already rejected for this deal by a booker and cannot be submitted again.',
      });
    }
    return res.status(409).json({ message: 'These card(s) are already submitted to this deal' });
  }
  res.status(201).json({ bookings: created, skipped, rejected });
}

/** Card holder: my bookings. */
async function listMine(req, res) {
  const bookings = await Booking.find({ cardHolder: req.user._id })
    .populate('deal')
    .populate('booker', 'name username')
    .populate('card', 'bank network type holderName last4 expiryMonth expiryYear')
    .sort({ updatedAt: -1 });
  res.json({ bookings: bookings.map(serializeForHolder) });
}

/** Booker: submissions still available to pick up (SUBMITTED, unassigned). */
async function available(req, res) {
  const filter = { status: 'SUBMITTED' };
  if (req.query.dealId) filter.deal = req.query.dealId;
  const bookings = await Booking.find(filter)
    .populate('deal')
    .populate('cardHolder', 'name username phone anonymousCode')
    .populate('card', 'bank network type holderName last4 expiryMonth expiryYear')
    .sort({ createdAt: 1 });
  res.json({ bookings: bookings.map(serializeForBooker) });
}

/** Booker: bookings assigned to me (active + history). */
async function mineAsBooker(req, res) {
  const bookings = await Booking.find({ booker: req.user._id })
    .populate('deal')
    .populate('cardHolder', 'name username phone anonymousCode')
    .populate('card', 'bank network type holderName last4 expiryMonth expiryYear')
    .sort({ updatedAt: -1 });
  res.json({ bookings: bookings.map(serializeForBooker) });
}

/**
 * Booker: reveal the full (decrypted) card number.
 * Allowed only while the booking is SUBMITTED (to check offer) or assigned to this booker
 * and not yet completed. Card exposure is cut off once the order is COMPLETED/closed.
 */
async function revealCard(req, res) {
  const booking = await Booking.findById(req.params.id).populate('card');
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const assignedToMe = booking.booker && String(booking.booker) === String(req.user._id);
  const openForPickup = booking.status === 'SUBMITTED';
  const exposed = ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(booking.status);
  if (exposed || (!assignedToMe && !openForPickup)) {
    return res.status(403).json({ message: 'Card no longer available for viewing' });
  }

  let cardDetails;
  
  // Handle saved card (encrypted in database)
  if (booking.card) {
    const number = decrypt(booking.card.numberEnc);
    let cvv = '';
    if (booking.card.cvvEnc) {
      try {
        cvv = decrypt(booking.card.cvvEnc);
      } catch (e) {
        cvv = '';
      }
    }
    cardDetails = {
      bank: booking.card.bank,
      network: booking.card.network,
      type: booking.card.type,
      holderName: booking.card.holderName,
      number,
      cvv,
      expiryMonth: booking.card.expiryMonth,
      expiryYear: booking.card.expiryYear,
    };
  }
  // Handle temporary card (inline cardData - not encrypted, stored directly)
  else if (booking.cardData) {
    cardDetails = {
      bank: booking.cardData.bank,
      network: booking.cardData.network,
      type: booking.cardData.type,
      holderName: booking.cardData.holderName,
      number: booking.cardData.number,
      cvv: booking.cardData.cvv || '',
      expiryMonth: booking.cardData.expiryMonth,
      expiryYear: booking.cardData.expiryYear,
    };
  }
  else {
    return res.status(500).json({ message: 'Card data not found' });
  }
  
  res.json({ card: cardDetails });
}

/** Booker accepts a submission (offer is applicable). */
async function accept(req, res) {
  const booking = await Booking.findById(req.params.id).populate('deal');
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (booking.status !== 'SUBMITTED') {
    return res.status(409).json({ message: 'Already picked up by another booker' });
  }
  booking.booker = req.user._id;
  booking.status = 'ACCEPTED';
  booking.acceptedAt = new Date();
  
  // Capture deal snapshot at acceptance time (if not already captured)
  if (!booking.dealSnapshot || !booking.dealSnapshot.price) {
    booking.dealSnapshot = {
      title: booking.deal?.title || 'Unknown Deal',
      platform: booking.deal?.platform || 'Unknown',
      product: booking.deal?.product || '',
      price: booking.deal?.price || 0,
      profit: booking.deal?.profit || 0,
    };
  }
  
  await booking.save();

  await notify(
    booking.cardHolder,
    'DEAL_ACCEPTED',
    'A booker accepted your deal (offer applies). They will place the order shortly — keep the app open.',
    booking._id
  );
  const full = await populated(booking._id);
  broadcast(full);
  emitToBookers('booking:taken', { bookingId: String(booking._id) });
  res.json({ booking: serializeForBooker(full) });
}

/**
 * Booker accepts MANY submissions at once (typically all cards from one card holder
 * for the same deal) so a holder's whole batch is picked up together.
 */
async function acceptMany(req, res) {
  const ids = Array.isArray(req.body.bookingIds) ? req.body.bookingIds : [];
  if (ids.length === 0) return res.status(400).json({ message: 'No bookings selected' });

  const bookings = await Booking.find({ _id: { $in: ids }, status: 'SUBMITTED' }).populate('deal');
  if (bookings.length === 0) {
    return res.status(409).json({ message: 'These submissions were already picked up' });
  }

  const acceptedIds = [];
  let holderId = null;
  for (const b of bookings) {
    b.booker = req.user._id;
    b.status = 'ACCEPTED';
    b.acceptedAt = new Date();
    
    // Capture deal snapshot at acceptance time
    if (!b.dealSnapshot || !b.dealSnapshot.price) {
      b.dealSnapshot = {
        title: b.deal?.title || 'Unknown Deal',
        platform: b.deal?.platform || 'Unknown',
        product: b.deal?.product || '',
        price: b.deal?.price || 0,
        profit: b.deal?.profit || 0,
      };
    }
    
    await b.save();
    holderId = String(b.cardHolder);
    acceptedIds.push(b._id);
    emitToBookers('booking:taken', { bookingId: String(b._id) });
  }

  if (holderId) {
    await notify(
      holderId,
      'DEAL_ACCEPTED',
      `A booker accepted ${acceptedIds.length} of your card(s) (offer applies). They will place the orders shortly — keep the app open.`,
      acceptedIds[0]
    );
  }
  for (const id of acceptedIds) broadcast(await populated(id));
  res.json({ accepted: acceptedIds.map(String) });
}

/** Card holder confirms MANY accepted bookings at once. */
async function confirmMany(req, res) {
  const ids = Array.isArray(req.body.bookingIds) ? req.body.bookingIds : [];
  if (ids.length === 0) return res.status(400).json({ message: 'No bookings selected' });

  const bookings = await Booking.find({
    _id: { $in: ids },
    cardHolder: req.user._id,
    status: 'ACCEPTED',
  });
  if (bookings.length === 0) return res.status(409).json({ message: 'Nothing to confirm' });

  const confirmedIds = [];
  let bookerId = null;
  for (const b of bookings) {
    b.status = 'CONFIRMED';
    await b.save();
    bookerId = String(b.booker);
    confirmedIds.push(b._id);
  }
  if (bookerId) {
    await notify(
      bookerId,
      'DEAL_CONFIRMED',
      `Card holder confirmed ${confirmedIds.length} card(s). You can proceed to send the OTP.`,
      confirmedIds[0]
    );
  }
  for (const id of confirmedIds) broadcast(await populated(id));
  res.json({ confirmed: confirmedIds.map(String) });
}

/** Card holder confirms the booker's acceptance -> deal is fully accepted. */
async function confirmAccept(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.cardHolder) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  if (booking.status !== 'ACCEPTED') {
    return res.status(409).json({ message: 'Nothing to confirm at this stage' });
  }
  booking.status = 'CONFIRMED';
  await booking.save();
  await notify(
    booking.booker,
    'DEAL_CONFIRMED',
    'Card holder confirmed the deal. You can proceed to send the OTP.',
    booking._id
  );
  const full = await populated(booking._id);
  broadcast(full);
  res.json({ booking: serializeForHolder(full) });
}

/** Booker rejects a submission. */
async function reject(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (!['SUBMITTED', 'OTP_REQUESTED'].includes(booking.status)) {
    return res.status(409).json({ message: 'Cannot reject at this stage' });
  }
  
  // Accept optional rejection reason from request body
  const { reason } = req.body;
  if (reason) {
    booking.rejectReason = reason;
  }
  
  // Rejection at the initial offer-check step (SUBMITTED) blocks re-submitting this card to this deal.
  if (booking.status === 'SUBMITTED') booking.offerRejected = true;
  booking.booker = req.user._id;
  booking.status = 'REJECTED';
  booking.otpDeadline = null;
  booking.otpCurrent = null;
  await booking.save();
  
  // Customize notification message based on reason
  let notificationMsg = 'A booker could not use your card for this deal.';
  if (reason === 'offer_not_applicable') {
    notificationMsg = 'Offer not applicable on this card for the deal.';
  }
  
  await notify(booking.cardHolder, 'DEAL_REJECTED', notificationMsg, booking._id);
  const full = await populated(booking._id);
  broadcast(full);
  res.json({ booking: serializeForBooker(full) });
}

/** Booker rings the card holder (long notification). Used after sending OTP. */
async function ringHolder(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.booker) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  
  // Can ring after OTP is submitted
  if (!['OTP_SUBMITTED', 'COMPLETED'].includes(booking.status)) {
    return res.status(409).json({ message: 'Can only ring after OTP is sent' });
  }
  
  await notify(
    booking.cardHolder,
    'BOOKER_RINGING',
    '🔔 Booker is calling you! Please check the order status.',
    booking._id
  );
  
  res.json({ ok: true, message: 'Card holder notified' });
}

/** Booker: ready to place order, requests the OTP. */
async function requestOtp(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  
  // Assign booker if not already assigned (when coming from SUBMITTED)
  if (!booking.booker) {
    booking.booker = req.user._id;
  }
  
  if (String(booking.booker) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  if (!['SUBMITTED', 'OTP_APPROVED', 'OTP_SUBMITTED'].includes(booking.status)) {
    return res.status(409).json({ message: 'Cannot start the OTP step at this stage' });
  }
  // Ask the card holder to approve ("OK, proceed") before the OTP is triggered.
  booking.status = 'OTP_REQUESTED';
  await booking.save();
  await notify(
    booking.cardHolder,
    'OTP_READY',
    'The booker is ready to place your order. Tap "OK, proceed" to trigger the OTP to your phone.',
    booking._id
  );
  const full = await populated(booking._id);
  broadcast(full);
  res.json({ booking: serializeForBooker(full) });
}

/**
 * Booker: "OTP sent" — booker triggered the OTP on the payment page. Starts a 3-minute
 * countdown; if the order is not completed before it elapses, the deal auto-rejects.
 */
async function markOtpSent(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.booker) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  if (!['OTP_REQUESTED', 'OTP_APPROVED', 'OTP_SUBMITTED'].includes(booking.status)) {
    return res.status(409).json({ message: 'Cannot start OTP timer at this stage' });
  }
  booking.otpDeadline = new Date(Date.now() + OTP_WINDOW_MS);
  await booking.save();
  await notify(
    booking.cardHolder,
    'OTP_SENT',
    '🔔 OTP is already sent to your phone — please enter it here within 3 minutes.',
    booking._id
  );
  const full = await populated(booking._id);
  
  // Send special alert to cardholder with sound notification
  const holderId = String(full.cardHolder._id || full.cardHolder);
  emitToUser(holderId, 'otp:sent-alert', {
    bookingId: String(booking._id),
    playSound: true,
    urgent: true,
    message: 'OTP has been sent to your phone! Enter it now.',
  });
  
  broadcast(full);
  res.json({ booking: serializeForBooker(full) });
}

/** Card holder: "Go ahead" — approve the booker to trigger the OTP. */
async function approveOtp(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.cardHolder) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  if (booking.status !== 'OTP_REQUESTED') {
    return res.status(409).json({ message: 'Nothing to approve' });
  }
  booking.status = 'OTP_APPROVED';
  await booking.save();
  await notify(booking.booker, 'OTP_APPROVED', 'Card holder approved. You can trigger the OTP now.', booking._id);
  const full = await populated(booking._id);
  broadcast(full);
  res.json({ booking: serializeForHolder(full) });
}

/** Card holder: submit / update the OTP (live-relayed to the booker). */
async function submitOtp(req, res) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: 'OTP code is required' });

  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.cardHolder) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  if (!['OTP_APPROVED', 'OTP_REQUESTED', 'OTP_SUBMITTED'].includes(booking.status)) {
    return res.status(409).json({ message: 'Cannot submit OTP at this stage' });
  }

  booking.otpCurrent = String(code);
  booking.otpHistory.push({ code: String(code), enteredAt: new Date(), kind: 'submitted' });
  booking.status = 'OTP_SUBMITTED';
  // OTP entered -> stop the countdown. It only restarts if the booker requests a resend.
  booking.otpDeadline = null;
  await booking.save();

  const full = await populated(booking._id);
  // Live OTP push to the booking room + the booker directly.
  emitToBooking(String(booking._id), 'otp:update', { bookingId: String(booking._id), otp: booking.otpCurrent });
  emitToUser(String(booking.booker), 'otp:update', { bookingId: String(booking._id), otp: booking.otpCurrent });
  await notify(booking.booker, 'OTP_SUBMITTED', 'Card holder submitted the OTP.', booking._id);
  broadcast(full);
  res.json({ booking: serializeForHolder(full) });
}

/** Booker: request a fresh OTP (resend). Clears current OTP and asks the holder for a new one. */
async function requestResend(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.booker) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  booking.otpCurrent = null;
  booking.resendCount += 1;
  booking.otpHistory.push({ enteredAt: new Date(), kind: 'resend_requested' });
  if (booking.status === 'OTP_SUBMITTED') booking.status = 'OTP_APPROVED';
  // Resend restarts the 3-minute window.
  booking.otpDeadline = new Date(Date.now() + OTP_WINDOW_MS);
  await booking.save();
  await notify(booking.cardHolder, 'OTP_RESEND', '🔔 Booker requested a new OTP. Please enter the latest OTP.', booking._id);
  
  const full = await populated(booking._id);
  
  // Send alert to cardholder with sound for resend
  const holderId = String(full.cardHolder._id || full.cardHolder);
  emitToUser(holderId, 'otp:sent-alert', {
    bookingId: String(booking._id),
    playSound: true,
    urgent: true,
    isResend: true,
    message: 'New OTP requested! Enter the latest one.',
  });
  
  emitToBooking(String(booking._id), 'otp:update', { bookingId: String(booking._id), otp: null });
  emitToUser(String(booking.booker), 'otp:update', { bookingId: String(booking._id), otp: null });
  broadcast(full);
  res.json({ booking: serializeForBooker(full) });
}

/** Booker: upload the order screenshot proof. */
async function uploadScreenshot(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.booker) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

  booking.screenshotUrl = `/uploads/${req.file.filename}`;
  await booking.save();
  const full = await populated(booking._id);
  broadcast(full);
  res.json({ booking: serializeForBooker(full) });
}

/** Booker: mark order complete (screenshot must already be uploaded). */
async function complete(req, res) {
  const booking = await Booking.findById(req.params.id).populate('deal');
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.booker) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  const wasCompleted = booking.status === 'COMPLETED';
  booking.status = 'COMPLETED';
  booking.completedAt = booking.completedAt || new Date();
  booking.orderNote = req.body.orderNote || booking.orderNote;
  booking.otpCurrent = null; // clear sensitive OTP once done
  booking.otpDeadline = null;

  // Create dealSnapshot if not already created
  if (!booking.dealSnapshot || !booking.dealSnapshot.price) {
    booking.dealSnapshot = {
      title: booking.deal?.title || 'Unknown Deal',
      platform: booking.deal?.platform || 'Unknown',
      product: booking.deal?.product || '',
      price: booking.deal?.price || 0,
      profit: booking.deal?.profit || 0,
    };
  }

  // Capture commission snapshot from the deal at completion time
  if (booking.deal && (!booking.commissionSnapshot || !booking.commissionSnapshot.bookerTotal)) {
    booking.commissionSnapshot = {
      bookerTotal: booking.deal.commission?.bookerTotal || 0,
      adminShare: booking.deal.commission?.adminShare || 0,
      cardholderShare: booking.deal.commission?.cardholderShare || 0,
    };
  }

  await booking.save();

  // Create ledger entries only on first completion
  if (!wasCompleted) {
    try {
      // Get the actual deal price from dealSnapshot
      const dealPrice = booking.dealSnapshot?.price || 0;
      const cardholderCommission = booking.commissionSnapshot?.cardholderShare || 0;
      const bookerCommission = booking.commissionSnapshot?.bookerTotal || 0;
      const adminCommission = booking.commissionSnapshot?.adminShare || 0;

      console.log(`[ledger] Creating ledgers for booking ${booking._id}:`);
      console.log(`  - Deal Price: ${dealPrice}`);
      console.log(`  - Cardholder Commission: ${cardholderCommission}`);
      console.log(`  - Booker Commission: ${bookerCommission}`);
      console.log(`  - Admin Commission: ${adminCommission}`);

      // Create card holder ledger entry
      // Amount = order price + cardholder commission share
      const cardholderAmount = dealPrice + cardholderCommission;

      const cardholderLedger = new Ledger({
        user: booking.cardHolder,
        type: 'cardholder_earning',
        booking: booking._id,
        deal: booking.deal._id,
        description: `Order: ${booking.dealSnapshot?.title || 'deal'} (${dealPrice}) + Commission (${cardholderCommission})`,
        amount: cardholderAmount,
        commission: {
          total: bookerCommission,
          adminShare: adminCommission,
          cardholderShare: cardholderCommission,
        },
        status: 'confirmed',
      });
      await cardholderLedger.save();
      booking.cardholderLedger = cardholderLedger._id;
      console.log(`  - Cardholder ledger created: ${cardholderAmount} (${dealPrice} + ${cardholderCommission} commission)`);

      // Create booker ledger entry
      // Amount = order price + TOTAL commission (what booker pays you)
      const bookerAmount = dealPrice + bookerCommission;

      const bookerLedger = new Ledger({
        user: booking.booker,
        type: 'booker_transaction',
        booking: booking._id,
        deal: booking.deal._id,
        description: `Order: ${booking.dealSnapshot?.title || 'deal'} (${dealPrice}) + Commission (${bookerCommission}) = Total Payment to Admin`,
        amount: bookerAmount,
        commission: {
          total: bookerCommission,
          adminShare: adminCommission,
          cardholderShare: cardholderCommission,
        },
        status: 'confirmed',
      });
      await bookerLedger.save();
      booking.bookerLedger = bookerLedger._id;
      console.log(`  - Booker ledger created: ${bookerAmount} (${dealPrice} + ${bookerCommission} commission) - PAYS TO ADMIN`);

      // Create admin ledger entry for admin's commission share
      if (adminCommission > 0) {
        const adminLedger = new Ledger({
          user: booking.deal.createdBy,
          type: 'admin_earning',
          booking: booking._id,
          deal: booking.deal._id,
          description: `Commission from ${booking.dealSnapshot?.title || 'deal'} - ${booking.dealSnapshot?.platform || 'Unknown'}`,
          amount: adminCommission,
          commission: {
            total: bookerCommission,
            adminShare: adminCommission,
            cardholderShare: cardholderCommission,
          },
          status: 'confirmed',
        });
        await adminLedger.save();
        booking.adminLedger = adminLedger._id;
        console.log(`  - Admin ledger created: ${adminCommission}`);
      }

      await booking.save();
    } catch (e) {
      console.error('[ledger] creation failed:', e.message, e.stack);
      // Don't fail the order completion if ledger creation fails
    }

    // Increment deal's completedCount
    if (booking.deal && booking.deal._id) {
      try {
        await Deal.findByIdAndUpdate(booking.deal._id, {
          $inc: { completedCount: 1 },
        });
        console.log(`[deal] Incremented completedCount for deal ${booking.deal._id}`);
      } catch (e) {
        console.error('[deal] Failed to increment completedCount:', e.message);
      }
    }

    try {
      await archiveCompletedOrder(await populated(booking._id));
    } catch (e) {
      console.error('[orderStats] archive failed:', e.message);
    }
  }

  const full = await populated(booking._id);
  await notify(booking.cardHolder, 'ORDER_COMPLETED', 'Your order has been placed successfully!', booking._id);
  broadcast(full);
  emitToAdmins('order:completed', serialize(full));
  res.json({ booking: serializeForBooker(full) });
}

/** Booker: mark the order as failed (couldn't be completed). Ends the booking. */
async function failOrder(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.booker) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your booking' });
  }
  if (!['OTP_REQUESTED', 'OTP_APPROVED', 'OTP_SUBMITTED'].includes(booking.status)) {
    return res.status(409).json({ message: 'Cannot mark this order failed at its current stage' });
  }
  booking.status = 'REJECTED';
  booking.otpDeadline = null;
  booking.otpCurrent = null;
  booking.orderNote = req.body.reason || 'Order failed';
  await booking.save();
  await notify(booking.cardHolder, 'DEAL_REJECTED', 'The booker could not complete this order.', booking._id);
  const full = await populated(booking._id);
  broadcast(full);
  res.json({ booking: serializeForBooker(full) });
}

module.exports = {
  submit,
  listMine,
  failOrder,
  available,
  mineAsBooker,
  revealCard,
  reject,
  ringHolder,
  requestOtp,
  markOtpSent,
  approveOtp,
  submitOtp,
  requestResend,
  uploadScreenshot,
  complete,
  populated,
  serialize,
  serializeForHolder,
  serializeForBooker,
};

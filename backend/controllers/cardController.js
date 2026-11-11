const Card = require('../models/Card');
const { encrypt, decrypt, maskCardNumber } = require('../utils/crypto');

function publicCard(card) {
  let cvv = '';
  if (card.cvvEnc) {
    try {
      cvv = decrypt(card.cvvEnc);
    } catch (e) {
      cvv = '';
    }
  }
  return {
    _id: card._id,
    bank: card.bank,
    network: card.network,
    type: card.type,
    holderName: card.holderName,
    last4: card.last4,
    masked: `**** **** **** ${card.last4}`,
    cvv, // owner's own card - returned so the holder can see it
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    active: card.active,
    createdAt: card.createdAt,
  };
}

/** Card holder adds a card. CVV is stored encrypted at the holder's request. */
async function createCard(req, res) {
  const { bank, network, type, holderName, number, expiryMonth, expiryYear, cvv } = req.body;
  if (!bank || !type || !holderName || !number || !expiryMonth || !expiryYear) {
    return res
      .status(400)
      .json({ message: 'bank, type, holderName, number, expiryMonth, expiryYear are required' });
  }
  const digits = String(number).replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) {
    return res.status(400).json({ message: 'Invalid card number' });
  }

  const m = Number(expiryMonth);
  // Accept both 2-digit (28) and 4-digit (2028) years.
  let y = Number(expiryYear);
  if (Number.isInteger(y) && y >= 0 && y < 100) y += 2000;
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    return res.status(400).json({ message: 'Expiry month must be a number between 1 and 12' });
  }
  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    return res.status(400).json({ message: 'Invalid expiry year' });
  }
  const now = new Date();
  if (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)) {
    return res.status(400).json({ message: 'Card has expired — expiry must be the current month or later' });
  }

  // Prevent adding the same card twice. Compare the full (decrypted) number
  // against the holder's existing active cards.
  const owned = await Card.find({ owner: req.user._id, active: true });
  const duplicate = owned.some((c) => {
    try {
      return decrypt(c.numberEnc) === digits;
    } catch (e) {
      return false;
    }
  });
  if (duplicate) {
    return res.status(409).json({ message: 'This card is already added to your account' });
  }

  let cvvEnc = '';
  if (cvv) {
    const cvvDigits = String(cvv).replace(/\D/g, '');
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      return res.status(400).json({ message: 'CVV must be 3 or 4 digits' });
    }
    cvvEnc = encrypt(cvvDigits);
  }

  const card = await Card.create({
    owner: req.user._id,
    bank,
    network: network || 'Other',
    type,
    holderName,
    numberEnc: encrypt(digits),
    cvvEnc,
    last4: digits.slice(-4),
    expiryMonth: m,
    expiryYear: y,
  });
  res.status(201).json({ card: publicCard(card) });
}

async function listMyCards(req, res) {
  const cards = await Card.find({ owner: req.user._id, active: true }).sort({ createdAt: -1 });
  res.json({ cards: cards.map(publicCard) });
}

async function deleteCard(req, res) {
  const card = await Card.findOne({ _id: req.params.id, owner: req.user._id });
  if (!card) return res.status(404).json({ message: 'Card not found' });
  card.active = false;
  await card.save();
  res.json({ ok: true });
}

module.exports = { createCard, listMyCards, deleteCard, publicCard };

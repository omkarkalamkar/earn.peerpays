const PushSubscription = require('../models/PushSubscription');
const { isEnabled } = require('../utils/push');

function publicKey(req, res) {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null, enabled: isEnabled() });
}

async function subscribe(req, res) {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ message: 'Invalid subscription' });
  }
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { user: req.user._id, endpoint, keys },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ ok: true });
}

async function unsubscribe(req, res) {
  const { endpoint } = req.body || {};
  if (endpoint) await PushSubscription.deleteOne({ endpoint, user: req.user._id });
  res.json({ ok: true });
}

module.exports = { publicKey, subscribe, unsubscribe };

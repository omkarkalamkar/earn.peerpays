const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let enabled = false;

function initPush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[push] VAPID keys not set - web push disabled (in-app notifications still work).');
    return;
  }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  enabled = true;
  console.log('[push] Web push enabled.');
}

function isEnabled() {
  return enabled;
}

/**
 * Sends a push notification to every registered device of a user.
 * Dead subscriptions (410/404) are pruned automatically.
 */
async function sendPushToUser(userId, payload) {
  if (!enabled) return;
  const subs = await PushSubscription.find({ user: userId });
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          console.error('[push] send error:', err.statusCode || err.message);
        }
      }
    })
  );
}

module.exports = { initPush, isEnabled, sendPushToUser };

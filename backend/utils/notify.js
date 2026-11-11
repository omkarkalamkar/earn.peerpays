const Notification = require('../models/Notification');
const { emitToUser } = require('./socket');
const { sendPushToUser } = require('./push');

/**
 * Creates a persistent notification, pushes it in real time (Socket.IO),
 * and sends a Web Push (lock-screen) notification to the user's devices.
 */
async function notify(userId, type, message, relatedBooking = null) {
  const notification = await Notification.create({
    user: userId,
    type,
    message,
    relatedBooking,
  });
  emitToUser(String(userId), 'notification', notification);
  // Fire-and-forget lock-screen push; never block the request on it.
  sendPushToUser(userId, {
    title: 'PeerPays',
    body: message,
    url: '/',
    type,
    bookingId: relatedBooking ? String(relatedBooking) : null,
  }).catch(() => {});
  return notification;
}

module.exports = { notify };

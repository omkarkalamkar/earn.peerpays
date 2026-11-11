const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] },
  });

  // Authenticate sockets via JWT passed in the handshake auth.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      socket.role = payload.role;
      next();
    } catch (err) {
      next(new Error('Unauthorized socket'));
    }
  });

  io.on('connection', (socket) => {
    // Personal room for targeted notifications.
    socket.join(`user:${socket.userId}`);
    // Bookers listen on a shared feed room for new available submissions.
    if (socket.role === 'booker') socket.join('bookers');
    // Viewers are read-only admins and receive the same live admin updates.
    if (socket.role === 'admin' || socket.role === 'viewer') socket.join('admins');

    // Allow clients to join/leave a specific booking room for the live OTP relay.
    socket.on('booking:join', (bookingId) => socket.join(`booking:${bookingId}`));
    socket.on('booking:leave', (bookingId) => socket.leave(`booking:${bookingId}`));
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

// Convenience emitters
function emitToUser(userId, event, payload) {
  getIO().to(`user:${userId}`).emit(event, payload);
}
function emitToBooking(bookingId, event, payload) {
  getIO().to(`booking:${bookingId}`).emit(event, payload);
}
function emitToBookers(event, payload) {
  getIO().to('bookers').emit(event, payload);
}
function emitToAdmins(event, payload) {
  getIO().to('admins').emit(event, payload);
}

module.exports = { initSocket, getIO, emitToUser, emitToBooking, emitToBookers, emitToAdmins };

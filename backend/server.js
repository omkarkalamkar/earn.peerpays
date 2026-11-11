require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');

const { connectDB } = require('./config/db');
const { initSocket } = require('./utils/socket');
const { initPush } = require('./utils/push');
const { seedData } = require('./utils/seedData');
const { startExpirySweeper } = require('./utils/expiry');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// Serve uploaded order screenshots
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/deals', require('./routes/deals'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/push', require('./routes/push'));
app.use('/api/ledger', require('./routes/ledger'));

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  initPush();
  // Auto-seed: always ensure an admin. Seed demo users/deals only for the ephemeral in-memory DB.
  await seedData({ withDemo: !process.env.MONGO_URI });
  const server = http.createServer(app);
  initSocket(server);
  startExpirySweeper();
  server.listen(PORT, () => console.log(`[server] API + Socket.IO listening on :${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

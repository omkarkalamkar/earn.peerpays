require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('./config/db');
const User = require('./models/User');

/**
 * Resets the admin password when the admin is locked out.
 *
 * Usage:
 *   node reset-admin.js "NewStrongPass123"          # reset the default/env admin
 *   node reset-admin.js "NewStrongPass123" myadmin  # reset a specific admin username
 *
 * If no password argument is given, ADMIN_PASSWORD from .env is used.
 */
(async () => {
  const newPassword = process.argv[2] || process.env.ADMIN_PASSWORD;
  const username = (process.argv[3] || process.env.ADMIN_USERNAME || 'admin').toLowerCase();

  if (!newPassword || String(newPassword).length < 6) {
    console.error('Provide a new password (min 6 chars): node reset-admin.js "NewPass123" [username]');
    process.exit(1);
  }

  await connectDB();

  let user = await User.findOne({ username });
  if (!user) {
    // Fall back to the first admin account if the username was not found.
    user = await User.findOne({ role: 'admin' });
  }
  if (!user) {
    console.error('No admin account found to reset.');
    await disconnectDB();
    process.exit(1);
  }

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  user.role = 'admin';
  user.active = true;
  await user.save();

  console.log(`[reset-admin] Password reset for admin "${user.username}".`);
  await disconnectDB();
  process.exit(0);
})().catch((e) => {
  console.error('[reset-admin] Failed:', e.message);
  process.exit(1);
});

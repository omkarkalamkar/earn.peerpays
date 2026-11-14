const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const user = await User.findOne({ username: String(username).toLowerCase() });
  if (!user || !user.active) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken(user);
  res.json({ token, user });
}

async function register(req, res) {
  const { username, password, name, phone, role } = req.body;
  
  // Validation
  if (!username || !password || !name) {
    return res.status(400).json({ message: 'Username, password, and name are required' });
  }
  
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  
  // Only allow cardholder registration for self-signup
  // Admin can create other roles via admin panel
  const userRole = role === 'cardholder' ? 'cardholder' : 'cardholder';
  
  // Check if username already exists
  const cleanUsername = String(username).toLowerCase().trim();
  const existing = await User.findOne({ username: cleanUsername });
  if (existing) {
    return res.status(409).json({ message: 'Username already taken' });
  }
  
  // Create new user
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username: cleanUsername,
    passwordHash,
    role: userRole,
    name: String(name).trim(),
    phone: phone ? String(phone).trim() : '',
    active: true,
  });
  
  // Auto-login after registration
  const token = signToken(user);
  res.status(201).json({ token, user });
}

async function me(req, res) {
  res.json({ user: req.user });
}

/** Logged-in user changes their own password (works for admin too). */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ ok: true });
}

module.exports = { login, register, me, changePassword, signToken };

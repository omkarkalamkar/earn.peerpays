#!/usr/bin/env node
/**
 * Migration: Generate anonymous codes for existing users
 * Usage: node backend/migrations/generateAnonymousCodes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function generateAnonymousCodes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all cardholders without anonymous codes
    const cardholders = await User.find({ 
      role: 'cardholder', 
      $or: [{ anonymousCode: null }, { anonymousCode: { $exists: false } }]
    }).sort({ createdAt: 1 });

    console.log(`Found ${cardholders.length} cardholders without codes`);

    for (let i = 0; i < cardholders.length; i++) {
      cardholders[i].anonymousCode = `C${i + 1}`;
      await cardholders[i].save();
      console.log(`Assigned ${cardholders[i].anonymousCode} to ${cardholders[i].name}`);
    }

    // Get all bookers without anonymous codes
    const bookers = await User.find({ 
      role: 'booker',
      $or: [{ anonymousCode: null }, { anonymousCode: { $exists: false } }]
    }).sort({ createdAt: 1 });

    console.log(`Found ${bookers.length} bookers without codes`);

    for (let i = 0; i < bookers.length; i++) {
      bookers[i].anonymousCode = `B${i + 1}`;
      await bookers[i].save();
      console.log(`Assigned ${bookers[i].anonymousCode} to ${bookers[i].name}`);
    }

    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

generateAnonymousCodes();

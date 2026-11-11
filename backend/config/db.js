const mongoose = require('mongoose');

let memoryServer = null;

/**
 * Connects to MongoDB.
 * - If MONGO_URI is set, connects to that (real MongoDB / Atlas).
 * - Otherwise spins up an in-memory MongoDB so the app runs locally with zero setup.
 */
async function connectDB() {
  let uri = process.env.MONGO_URI;

  if (!uri) {
    // Lazy-require so production installs without the dev dep still work when MONGO_URI is set.
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    console.log('[db] No MONGO_URI provided - started in-memory MongoDB at', uri);
    console.log('[db] NOTE: in-memory data resets on restart. Set MONGO_URI for persistence.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: 'mobile_booking' });
  console.log('[db] Connected to MongoDB');
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

module.exports = { connectDB, disconnectDB };

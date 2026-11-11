require('dotenv').config();
const { connectDB, disconnectDB } = require('./config/db');
const { seedData } = require('./utils/seedData');

(async () => {
  if (!process.env.MONGO_URI) {
    console.warn(
      '[seed] WARNING: MONGO_URI is not set. This will seed an in-memory DB that is discarded ' +
        'immediately. Set MONGO_URI to seed a persistent database.'
    );
  }
  await connectDB();
  await seedData({ withDemo: true });
  await disconnectDB();
  console.log('[seed] Done');
  process.exit(0);
})();

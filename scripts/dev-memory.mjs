/**
 * Temporary: runs the real API on port 5000 against an in-memory MongoDB so
 * the booking flow can be exercised in a real browser. Deleted after
 * verification — production uses `npm start` with a real MONGODB_URI.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create({ instance: { version: '6.0.16' } });
process.env.MONGODB_URI = mongod.getUri('portfolio_bookings');
process.env.NODE_ENV = 'development';
process.env.CORS_ORIGIN = 'http://localhost:5173,http://localhost:5174';
process.env.PORT = '5000';

const { connectDatabase } = await import('../src/config/db.js');
await connectDatabase();
const { createApp } = await import('../src/app.js');
const app = createApp();

const server = app.listen(5000, () => {
  console.log('[dev-memory] API listening on http://localhost:5000 (in-memory MongoDB)');
});

const shutdown = async () => {
  server.close();
  await mongod.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

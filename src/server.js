import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { assertEnv, env } from './config/env.js';

async function start() {
  try {
    assertEnv();
  } catch (error) {
    console.error(`\n[server] ${error.message}\n`);
    process.exit(1);
  }

  try {
    await connectDatabase();
    console.log(`[server] MongoDB connected (${env.nodeEnv}).`);
  } catch (error) {
    console.error('[server] Could not connect to MongoDB:', error.message);
    console.error('[server] Check MONGODB_URI in server/.env and that the database is reachable.');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] API listening on http://localhost:${env.port}`);
    console.log('[server] Routes: GET /api/health · GET /api/bookings/availability · POST /api/bookings · POST /api/messages');
  });

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received — shutting down.`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();

import mongoose from 'mongoose';

import { env } from './env.js';

// Without buffering, a query issued while disconnected fails immediately
// instead of hanging until the driver timeout — the API can answer 503 fast.
mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);

const STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export function databaseState() {
  return STATE_LABELS[mongoose.connection.readyState] ?? 'unknown';
}

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase() {
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10,
  });

  // Index builds run in the background by default, and Mongoose's automatic
  // open-time init silently fails under `bufferCommands: false` (a known race
  // on the native connection), so the unique slot index would not exist for
  // the first requests. Build the schema indexes explicitly before traffic:
  // this is what enforces duplicate-booking protection, so it must not race.
  await Promise.all(
    Object.values(mongoose.models).map((model) =>
      model.ensureIndexes().catch((error) => {
        throw new Error(
          `Could not build indexes for "${model.modelName}" — duplicate booking protection may be missing. ${error.message}`,
        );
      }),
    ),
  );

  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

/** Routes that cannot work without a database answer 503 instead of hanging. */
export function requireDatabase(req, res, next) {
  if (isDatabaseReady()) return next();
  return res.status(503).json({
    error: 'database-unavailable',
    message:
      'The booking database is not reachable right now, so live slots cannot be loaded. Please try again in a moment.',
  });
}

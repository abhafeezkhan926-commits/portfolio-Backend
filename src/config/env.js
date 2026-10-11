/**
 * Environment loading and validation.
 *
 * Secrets live only here, on the server. Nothing in this file is ever sent to
 * the browser, and `server/.env` is git-ignored.
 */

import 'dotenv/config';

function readString(key, fallback = '') {
  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : fallback;
}

function readInteger(key, fallback) {
  const raw = readString(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: readString('NODE_ENV', 'development'),
  port: readInteger('PORT', 5000),
  mongoUri: readString('MONGODB_URI'),
  corsOrigins: readString('CORS_ORIGIN')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export const isProduction = env.nodeEnv === 'production';

/** Fails fast at boot when a required value is missing. */
export function assertEnv() {
  if (!env.mongoUri) {
    throw new Error(
      'MONGODB_URI is not set. Copy server/.env.example to server/.env and add your connection string.',
    );
  }
}

export default env;

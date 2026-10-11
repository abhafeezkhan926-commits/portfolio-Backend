import { env, isProduction } from '../config/env.js';
import { ValidationError } from '../lib/validation.js';

export class HttpError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'not-found',
    message: `No API route matches ${req.method} ${req.originalUrl}.`,
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(error, req, res, next) {
  if (error instanceof ValidationError || error instanceof HttpError) {
    return res.status(error.status).json({
      error: error.code,
      message: error.message,
      details: error.details ?? null,
    });
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'invalid-json',
      message: 'The request body was not valid JSON.',
    });
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'payload-too-large',
      message: 'That request was too large.',
    });
  }

  if (error?.name === 'MongooseServerSelectionError' || error?.name === 'MongoServerSelectionError') {
    return res.status(503).json({
      error: 'database-unavailable',
      message: 'The database is not reachable right now. Please try again in a moment.',
    });
  }

  console.error('[api] Unhandled error:', error);

  return res.status(500).json({
    error: 'server-error',
    message: 'Something went wrong on the server. Please try again.',
    ...(isProduction ? {} : { debug: error?.message }),
  });
}

export function corsOptions() {
  const allowed = env.corsOrigins;

  return {
    origin(origin, callback) {
      // Same-origin requests (and curl / server-to-server) send no Origin header.
      if (!origin) return callback(null, true);
      if (allowed.length === 0) {
        // No configured origins: only allow in development so a fresh clone works.
        return callback(null, !isProduction);
      }
      return callback(null, allowed.includes(origin));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    maxAge: 86400,
  };
}

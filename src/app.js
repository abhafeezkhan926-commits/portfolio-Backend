import cors from 'cors';
import express from 'express';

import { corsOptions, errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import bookingsRouter from './routes/bookings.js';
import healthRouter from './routes/health.js';
import messagesRouter from './routes/messages.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Trust the first proxy hop so req.ip is meaningful behind a host like Render.
  app.set('trust proxy', 1);

  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '10kb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use('/api/health', healthRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/messages', messagesRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;

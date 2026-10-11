import { Router } from 'express';

import { databaseState } from '../config/db.js';
import { env } from '../config/env.js';
import { schedule } from '../config/schedule.js';

const router = Router();

router.get('/', (req, res) => {
  const database = databaseState();
  const healthy = database === 'connected';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'portfolio-api',
    environment: env.nodeEnv,
    database,
    timezone: schedule.timezone,
    timezoneLabel: schedule.timezoneLabel,
    slotMinutes: schedule.slotMinutes,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;

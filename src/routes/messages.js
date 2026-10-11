import { Router } from 'express';

import { requireDatabase } from '../config/db.js';
import { validateMessage } from '../lib/validation.js';
import { Message } from '../models/Message.js';

const router = Router();

router.post('/', requireDatabase, async (req, res, next) => {
  try {
    const { name, email, subject, message } = validateMessage(req.body);

    const saved = await Message.create({
      name,
      email,
      subject,
      message,
      meta: {
        userAgent: String(req.get('user-agent') ?? '').slice(0, 300),
        referrer: String(req.get('referer') ?? '').slice(0, 300),
      },
    });

    return res.status(201).json({
      message: 'Message received.',
      id: saved._id.toString(),
      createdAt: saved.createdAt.toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', (req, res) => {
  res.status(405).json({
    error: 'method-not-allowed',
    message: 'Messages are private. Use POST to send one.',
  });
});

export default router;

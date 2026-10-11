import { Router } from 'express';
import mongoose from 'mongoose';

import { requireDatabase } from '../config/db.js';
import { schedule } from '../config/schedule.js';
import {
  SLOT_STATE,
  describeDate,
  generateSlots,
  isWithinHorizon,
  latestBookableDate,
  summariseDate,
} from '../lib/availability.js';
import { HttpError } from '../middleware/errorHandler.js';
import { validateBooking } from '../lib/validation.js';
import {
  isValidDateKey,
  isValidTimeKey,
  pktWallToUtc,
  todayDateKeyInPkt,
} from '../lib/time.js';
import { Booking } from '../models/Booking.js';

const router = Router();

const MAX_RANGE_DAYS = 70;

function parseDateParam(value, field) {
  if (typeof value !== 'string' || !isValidDateKey(value)) {
    throw new HttpError(
      400,
      'invalid-date',
      `The "${field}" value must be a real calendar date in YYYY-MM-DD format.`,
    );
  }
  return value;
}

async function bookedTimeKeysFor(dateKey) {
  const rows = await Booking.find({ dateKey, status: 'confirmed' })
    .select('timeKey -_id')
    .lean();
  return new Set(rows.map((row) => row.timeKey));
}

/**
 * GET /api/bookings/availability
 *   ?date=YYYY-MM-DD            → full slot list for one day
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD → per-day availability summary for calendars
 */
router.get('/availability', requireDatabase, async (req, res, next) => {
  try {
    const now = new Date();

    if (req.query.date) {
      const dateKey = parseDateParam(req.query.date, 'date');
      const descriptor = describeDate(dateKey, now);
      const booked = await bookedTimeKeysFor(dateKey);
      const slots = generateSlots(dateKey, now, booked);

      return res.json({
        date: dateKey,
        timezone: schedule.timezone,
        timezoneLabel: schedule.timezoneLabel,
        slotMinutes: schedule.slotMinutes,
        isToday: descriptor.isToday,
        isSelectable: descriptor.isSelectable,
        closedReason: descriptor.closedReason,
        slots,
        summary: summariseDate(slots),
      });
    }

    if (req.query.from || req.query.to) {
      const from = parseDateParam(req.query.from ?? todayDateKeyInPkt(now), 'from');
      const to = parseDateParam(req.query.to ?? latestBookableDate(now), 'to');
      if (to < from) {
        throw new HttpError(400, 'invalid-range', 'The "to" date must not be before the "from" date.');
      }

      const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
      if (span > MAX_RANGE_DAYS) {
        throw new HttpError(400, 'range-too-wide', `Please request at most ${MAX_RANGE_DAYS} days at a time.`);
      }

      const rows = await Booking.find({
        dateKey: { $gte: from, $lte: to },
        status: 'confirmed',
      })
        .select('dateKey timeKey -_id')
        .lean();

      const grouped = new Map();
      for (const row of rows) {
        if (!grouped.has(row.dateKey)) grouped.set(row.dateKey, new Set());
        grouped.get(row.dateKey).add(row.timeKey);
      }

      const days = [];
      for (let cursor = from; cursor <= to; cursor = addOneDay(cursor)) {
        const descriptor = describeDate(cursor, now);
        const slots = generateSlots(cursor, now, grouped.get(cursor) ?? new Set());
        const summary = summariseDate(slots);
        days.push({
          date: cursor,
          isToday: descriptor.isToday,
          isSelectable: descriptor.isSelectable && summary.available > 0,
          closedReason: descriptor.isSelectable && summary.available === 0
            ? 'Fully booked'
            : descriptor.closedReason,
          available: summary.available,
          total: summary.total,
        });
      }

      return res.json({
        from,
        to,
        timezone: schedule.timezone,
        timezoneLabel: schedule.timezoneLabel,
        slotMinutes: schedule.slotMinutes,
        maxAdvanceDays: schedule.maxAdvanceDays,
        days,
      });
    }

    throw new HttpError(
      400,
      'missing-parameters',
      'Provide ?date=YYYY-MM-DD, or a ?from= and ?to= range.',
    );
  } catch (error) {
    return next(error);
  }
});

function addOneDay(dateKey) {
  const next = new Date(Date.parse(`${dateKey}T00:00:00Z`) + 86_400_000);
  return next.toISOString().slice(0, 10);
}

/** POST /api/bookings — validates, recomputes the instant server-side, stores it. */
router.post('/', requireDatabase, async (req, res, next) => {
  try {
    const { name, email, phone, notes, date, time } = validateBooking(req.body);

    if (!isValidDateKey(date)) {
      throw new HttpError(422, 'invalid-date', 'Please choose a real calendar date.');
    }
    if (!isWithinHorizon(date, new Date())) {
      throw new HttpError(
        422,
        'out-of-range',
        `Calls can be booked from today up to ${schedule.maxAdvanceDays} days ahead.`,
      );
    }
    if (!isValidTimeKey(time)) {
      throw new HttpError(
        422,
        'invalid-time',
        `Please pick a ${schedule.slotMinutes}-minute slot between ${schedule.window.start} and ${schedule.window.end} (${schedule.timezoneLabel}).`,
      );
    }

    const descriptor = describeDate(date, new Date());
    if (!descriptor.isSelectable) {
      throw new HttpError(
        422,
        'date-unavailable',
        descriptor.closedReason ?? 'That date is not open for bookings.',
      );
    }

    // The instant is always derived from the PKT wall clock the visitor picked,
    // never from a timestamp sent by the browser.
    const scheduledAt = pktWallToUtc(date, time);
    const leadCutoff = Date.now() + schedule.leadTimeMinutes * 60_000;
    if (scheduledAt.getTime() <= leadCutoff) {
      throw new HttpError(
        409,
        'slot-too-soon',
        `That time is less than ${schedule.leadTimeMinutes} minutes away. Please pick a later slot.`,
      );
    }

    const booking = await Booking.create({
      name,
      email,
      phone,
      notes,
      scheduledAt,
      dateKey: date,
      timeKey: time,
      timezone: schedule.timezone,
      durationMinutes: schedule.slotMinutes,
      status: 'confirmed',
    });

    return res.status(201).json({
      message: 'Your call is confirmed.',
      booking: booking.toPublicJSON(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return next(
        new HttpError(
          409,
          'slot-taken',
          'That slot was just taken by someone else. Please choose another time.',
        ),
      );
    }
    if (error instanceof mongoose.Error.ValidationError) {
      const details = Object.fromEntries(
        Object.entries(error.errors).map(([field, issue]) => [field, issue.message]),
      );
      return next(new HttpError(422, 'validation-failed', 'Some details look invalid. Please review them.', details));
    }
    return next(error);
  }
});

router.get('/', (req, res) => {
  res.status(405).json({
    error: 'method-not-allowed',
    message: 'Booking records are private. Use POST to create a booking, or GET /availability to see open slots.',
  });
});

export default router;

/**
 * Booking schedule rules. Change the values here to change the slot grid the
 * API generates — the frontend reads the same shape from
 * GET /api/bookings/availability and never hardcodes slots of its own.
 *
 * Asia/Karachi is a fixed UTC+5 offset with no daylight saving, so the wall
 * clock can be converted with a constant.
 */

export const schedule = {
  timezone: 'Asia/Karachi',
  timezoneLabel: 'Pakistan Standard Time (PKT)',
  utcOffsetMinutes: 300,

  /** Call length in minutes. */
  slotMinutes: 15,

  /** How soon from now a slot may be booked. */
  leadTimeMinutes: 45,

  /** How far ahead the calendar is open. */
  maxAdvanceDays: 60,

  /** 0 = Sunday … 6 = Saturday. */
  workingDays: [1, 2, 3, 4, 5, 6],

  /** Bookable window as PKT wall-clock times, half-open: [start, end). */
  window: { start: '10:00', end: '18:00' },
};

export default schedule;

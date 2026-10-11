/**
 * Asia/Karachi is a fixed-offset timezone (UTC+5, no daylight saving), so all
 * conversions here are plain arithmetic. This keeps the booking maths exact and
 * dependency-free.
 */

import { schedule } from '../config/schedule.js';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const probe = new Date(utc);
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

export function isValidTimeKey(value) {
  if (typeof value !== 'string' || !TIME_KEY_PATTERN.test(value)) return false;
  const minutes = minutesFromTimeKey(value);
  const start = minutesFromTimeKey(schedule.window.start);
  const end = minutesFromTimeKey(schedule.window.end);
  if (minutes < start || minutes > end - schedule.slotMinutes) return false;
  return (minutes - start) % schedule.slotMinutes === 0;
}

export function minutesFromTimeKey(timeKey) {
  const [hours, minutes] = timeKey.split(':').map(Number);
  return hours * 60 + minutes;
}

export function timeKeyFromMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Converts a PKT wall-clock date + time into the matching UTC instants. */
export function pktWallToUtc(dateKey, timeKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const minutes = minutesFromTimeKey(timeKey);
  return new Date(
    Date.UTC(year, month - 1, day, 0, minutes - schedule.utcOffsetMinutes),
  );
}

/** The PKT calendar date (YYYY-MM-DD) that an instant falls on. */
export function dateKeyInPkt(instant) {
  const shifted = new Date(instant.getTime() + schedule.utcOffsetMinutes * MINUTE_MS);
  return shifted.toISOString().slice(0, 10);
}

/** The PKT wall-clock time (HH:mm) an instant falls on. */
export function timeKeyInPkt(instant) {
  const shifted = new Date(instant.getTime() + schedule.utcOffsetMinutes * MINUTE_MS);
  return shifted.toISOString().slice(11, 16);
}

export function todayDateKeyInPkt(now = new Date()) {
  return dateKeyInPkt(now);
}

export function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

export function dayOfWeek(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isWorkingDay(dateKey) {
  return schedule.workingDays.includes(dayOfWeek(dateKey));
}

/** Whole days between two PKT date keys (to - from). */
export function daysBetween(fromDateKey, toDateKey) {
  const from = Date.parse(`${fromDateKey}T00:00:00Z`);
  const to = Date.parse(`${toDateKey}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

export function formatPktDate(dateKey, options = {}) {
  const instant = pktWallToUtc(dateKey, '12:00');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(instant);
}

export { MINUTE_MS, DAY_MS };

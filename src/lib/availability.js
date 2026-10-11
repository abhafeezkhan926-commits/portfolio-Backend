/**
 * Pure slot-generation logic: given a PKT date key, a "now" instant and the
 * set of already-booked PKT time keys for that date, produce the slot list the
 * /book-call calendar renders. Kept free of Express/Mongoose so it is unit
 * testable.
 */

import { schedule } from '../config/schedule.js';
import {
  addDays,
  daysBetween,
  isWorkingDay,
  minutesFromTimeKey,
  pktWallToUtc,
  timeKeyFromMinutes,
  todayDateKeyInPkt,
} from './time.js';

export const SLOT_STATE = {
  available: 'available',
  booked: 'booked',
  past: 'past',
};

export function describeDate(dateKey, now = new Date()) {
  const offset = daysBetween(todayDateKeyInPkt(now), dateKey);
  const isToday = offset === 0;
  const closed = !isWorkingDay(dateKey);
  const beyondHorizon = offset > schedule.maxAdvanceDays || offset < 0;

  const lastSlotStart = minutesFromTimeKey(schedule.window.end) - schedule.slotMinutes;
  const lastSlot = pktWallToUtc(dateKey, timeKeyFromMinutes(lastSlotStart));
  const fullDayCutoff = offset === 0
    && lastSlot.getTime() <= now.getTime() + schedule.leadTimeMinutes * 60_000;

  let closedReason = null;
  if (closed) closedReason = 'Closed on Sundays';
  else if (offset < 0) closedReason = 'That date has already passed';
  else if (offset > schedule.maxAdvanceDays) closedReason = `Bookings open ${schedule.maxAdvanceDays} days ahead`;
  else if (fullDayCutoff) closedReason = 'No more slots left today';

  return {
    date: dateKey,
    isToday,
    isSelectable: !closed && !beyondHorizon && !fullDayCutoff,
    closedReason,
  };
}

export function generateSlots(dateKey, now = new Date(), bookedTimeKeys = new Set()) {
  const todayKey = todayDateKeyInPkt(now);
  const offset = daysBetween(todayKey, dateKey);
  const closed = !isWorkingDay(dateKey);

  if (closed || offset < 0 || offset > schedule.maxAdvanceDays) return [];

  const startMinutes = minutesFromTimeKey(schedule.window.start);
  const endMinutes = minutesFromTimeKey(schedule.window.end);
  const cutoff = now.getTime() + schedule.leadTimeMinutes * 60_000;
  const slots = [];

  for (let minutes = startMinutes; minutes + schedule.slotMinutes <= endMinutes; minutes += schedule.slotMinutes) {
    const timeKey = timeKeyFromMinutes(minutes);
    const startsAt = pktWallToUtc(dateKey, timeKey);
    const isPast = startsAt.getTime() <= cutoff;
    const isBooked = bookedTimeKeys.has(timeKey);

    slots.push({
      time: timeKey,
      label: formatSlotLabel(minutes),
      state: isBooked ? SLOT_STATE.booked : isPast ? SLOT_STATE.past : SLOT_STATE.available,
      startsAt: startsAt.toISOString(),
    });
  }

  return slots;
}

function formatSlotLabel(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  // Minutes are always shown so a grid of slot chips lines up visually.
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function summariseDate(slots) {
  const available = slots.filter((slot) => slot.state === SLOT_STATE.available).length;
  const booked = slots.filter((slot) => slot.state === SLOT_STATE.booked).length;
  const past = slots.filter((slot) => slot.state === SLOT_STATE.past).length;
  return { total: slots.length, available, booked, past };
}

export function isWithinHorizon(dateKey, now = new Date()) {
  const offset = daysBetween(todayDateKeyInPkt(now), dateKey);
  return offset >= 0 && offset <= schedule.maxAdvanceDays;
}

export function latestBookableDate(now = new Date()) {
  return addDays(todayDateKeyInPkt(now), schedule.maxAdvanceDays);
}

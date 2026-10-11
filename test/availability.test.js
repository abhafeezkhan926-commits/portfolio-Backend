import assert from 'node:assert/strict';
import test from 'node:test';

import { schedule } from '../src/config/schedule.js';
import {
  SLOT_STATE,
  describeDate,
  generateSlots,
  isWithinHorizon,
  latestBookableDate,
  summariseDate,
} from '../src/lib/availability.js';

// A fixed "now": Friday 2026-10-09, 11:00 in Pakistan.
const NOW = new Date('2026-10-09T06:00:00.000Z');

test('a full working day yields 32 fifteen-minute slots', () => {
  const slots = generateSlots('2026-10-12', NOW); // Monday
  assert.equal(slots.length, 32);
  assert.equal(slots[0].time, '10:00');
  assert.equal(slots[0].label, '10:00 AM');
  assert.equal(slots.at(-1).time, '17:45');
  assert.equal(slots.at(-1).label, '5:45 PM');
  assert.ok(slots.every((slot) => slot.state === SLOT_STATE.available));
});

test('Sundays are closed and produce no slots', () => {
  assert.equal(schedule.workingDays.includes(0), false);
  const slots = generateSlots('2026-10-11', NOW); // Sunday
  assert.deepEqual(slots, []);
});

test('dates outside the booking horizon produce no slots', () => {
  assert.deepEqual(generateSlots('2026-10-08', NOW), [], 'yesterday');
  const beyond = latestBookableDate(NOW);
  assert.ok(generateSlots(beyond, NOW).length > 0, 'the last day of the horizon is still open');
  assert.deepEqual(generateSlots(addOne(beyond), NOW), [], 'one day past the horizon');
});

test('booked time keys are marked and excluded from availability', () => {
  const booked = new Set(['10:00', '14:30']);
  const slots = generateSlots('2026-10-12', NOW, booked);
  const states = Object.fromEntries(slots.map((slot) => [slot.time, slot.state]));

  assert.equal(states['10:00'], SLOT_STATE.booked);
  assert.equal(states['14:30'], SLOT_STATE.booked);
  assert.equal(states['10:15'], SLOT_STATE.available);

  const summary = summariseDate(slots);
  assert.equal(summary.total, 32);
  assert.equal(summary.booked, 2);
  assert.equal(summary.available, 30);
  assert.equal(summary.past, 0);
});

test('slots inside the lead time are marked past, not available', () => {
  // NOW is 11:00 PKT and the lead time is 45 minutes, so everything up to and
  // including 11:45 has passed; 12:00 is the first bookable slot.
  const slots = generateSlots('2026-10-09', NOW); // same day
  const states = Object.fromEntries(slots.map((slot) => [slot.time, slot.state]));

  assert.equal(states['10:00'], SLOT_STATE.past);
  assert.equal(states['11:30'], SLOT_STATE.past);
  assert.equal(states['11:45'], SLOT_STATE.past, 'a slot starting exactly at the cutoff is too soon');
  assert.equal(states['12:00'], SLOT_STATE.available);

  const summary = summariseDate(slots);
  assert.equal(summary.past, 8);
  assert.equal(summary.available, 24);
});

test('describeDate reports why a day cannot be picked', () => {
  assert.equal(describeDate('2026-10-12', NOW).isSelectable, true);

  const sunday = describeDate('2026-10-11', NOW);
  assert.equal(sunday.isSelectable, false);
  assert.match(sunday.closedReason, /Sunday/);

  const yesterday = describeDate('2026-10-08', NOW);
  assert.equal(yesterday.isSelectable, false);
  assert.match(yesterday.closedReason, /passed/);

  assert.equal(describeDate('2026-10-09', NOW).isToday, true);
  assert.equal(describeDate('2026-10-12', NOW).isToday, false);
});

test('a fully passed day is no longer selectable', () => {
  const afterClose = new Date('2026-10-09T14:00:00.000Z'); // 19:00 PKT
  const today = describeDate('2026-10-09', afterClose);
  assert.equal(today.isSelectable, false);
  assert.match(today.closedReason, /No more slots/);
});

test('isWithinHorizon accepts today and rejects the far future', () => {
  assert.equal(isWithinHorizon('2026-10-09', NOW), true);
  assert.equal(isWithinHorizon('2026-10-08', NOW), false);
  assert.equal(isWithinHorizon(addOne(latestBookableDate(NOW)), NOW), false);
});

test('slot timestamps are correct UTC instants', () => {
  const slots = generateSlots('2026-10-12', NOW);
  const first = slots.find((slot) => slot.time === '10:00');
  assert.equal(first.startsAt, '2026-10-12T05:00:00.000Z');
});

function addOne(dateKey) {
  const next = new Date(Date.parse(`${dateKey}T00:00:00Z`) + 86_400_000);
  return next.toISOString().slice(0, 10);
}

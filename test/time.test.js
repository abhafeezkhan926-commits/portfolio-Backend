import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addDays,
  dateKeyInPkt,
  dayOfWeek,
  daysBetween,
  isWorkingDay,
  isValidDateKey,
  isValidTimeKey,
  minutesFromTimeKey,
  pktWallToUtc,
  timeKeyFromMinutes,
  timeKeyInPkt,
  todayDateKeyInPkt,
} from '../src/lib/time.js';

test('isValidDateKey accepts real dates and rejects impossible ones', () => {
  assert.equal(isValidDateKey('2026-10-09'), true);
  assert.equal(isValidDateKey('2026-02-29'), false, '2026 is not a leap year');
  assert.equal(isValidDateKey('2024-02-29'), true);
  assert.equal(isValidDateKey('2026-13-01'), false);
  assert.equal(isValidDateKey('2026-10-32'), false);
  assert.equal(isValidDateKey('09-10-2026'), false);
  assert.equal(isValidDateKey(''), false);
  assert.equal(isValidDateKey(20261009), false);
});

test('isValidTimeKey only allows slots on the 15-minute grid inside the window', () => {
  assert.equal(isValidTimeKey('10:00'), true);
  assert.equal(isValidTimeKey('10:15'), true);
  assert.equal(isValidTimeKey('17:45'), true, 'last slot before an 18:00 close');
  assert.equal(isValidTimeKey('09:45'), false, 'before the window opens');
  assert.equal(isValidTimeKey('18:00'), false, 'the window closes at 18:00');
  assert.equal(isValidTimeKey('10:07'), false, 'not aligned to the slot grid');
  assert.equal(isValidTimeKey('1:00'), false);
  assert.equal(isValidTimeKey('noon'), false);
});

test('pktWallToUtc converts Pakistan wall clock (UTC+5) to UTC', () => {
  assert.equal(pktWallToUtc('2026-10-12', '10:00').toISOString(), '2026-10-12T05:00:00.000Z');
  assert.equal(pktWallToUtc('2026-10-12', '17:45').toISOString(), '2026-10-12T12:45:00.000Z');
  assert.equal(pktWallToUtc('2026-01-01', '00:00').toISOString(), '2025-12-31T19:00:00.000Z');
});

test('dateKeyInPkt / timeKeyInPkt read an instant in Pakistan local time', () => {
  const lateUtc = new Date('2026-10-11T20:30:00.000Z');
  assert.equal(dateKeyInPkt(lateUtc), '2026-10-12', 'after 7pm UTC it is already the next day in PKT');
  assert.equal(timeKeyInPkt(lateUtc), '01:30');

  const morning = new Date('2026-10-12T04:45:00.000Z');
  assert.equal(dateKeyInPkt(morning), '2026-10-12');
  assert.equal(timeKeyInPkt(morning), '09:45');
});

test('todayDateKeyInPkt is the PKT date, not the UTC date', () => {
  assert.equal(todayDateKeyInPkt(new Date('2026-10-09T18:00:00.000Z')), '2026-10-09');
  assert.equal(todayDateKeyInPkt(new Date('2026-10-09T19:00:00.000Z')), '2026-10-10');
});

test('minutesFromTimeKey and timeKeyFromMinutes round-trip', () => {
  assert.equal(minutesFromTimeKey('00:00'), 0);
  assert.equal(minutesFromTimeKey('10:15'), 615);
  assert.equal(timeKeyFromMinutes(615), '10:15');
  assert.equal(timeKeyFromMinutes(570), '09:30');
  assert.equal(timeKeyFromMinutes(0), '00:00');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-10-09', 60), '2026-12-08');
});

test('daysBetween counts whole days between date keys', () => {
  assert.equal(daysBetween('2026-10-09', '2026-10-09'), 0);
  assert.equal(daysBetween('2026-10-09', '2026-10-12'), 3);
  assert.equal(daysBetween('2026-10-12', '2026-10-09'), -3);
});

test('Sundays are not working days', () => {
  assert.equal(dayOfWeek('2026-10-11'), 0, '2026-10-11 is a Sunday');
  assert.equal(isWorkingDay('2026-10-11'), false);
  assert.equal(isWorkingDay('2026-10-12'), true);
  assert.equal(isWorkingDay('2026-10-10'), true, 'Saturday is a working day');
});

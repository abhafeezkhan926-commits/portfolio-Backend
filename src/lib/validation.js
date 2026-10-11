/**
 * Server-side validation. The browser validates too, but nothing here trusts
 * that — every field is re-checked before it reaches the database.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+()\d][\d\s().-]{5,31}$/;

export class ValidationError extends Error {
  constructor(details) {
    super('Some of the details look invalid. Please review them and try again.');
    this.name = 'ValidationError';
    this.status = 422;
    this.code = 'validation-failed';
    this.details = details;
  }
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateMessage(payload = {}) {
  const details = {};
  const name = asString(payload.name);
  const email = asString(payload.email);
  const subject = asString(payload.subject);
  const message = asString(payload.message);

  if (name.length < 2 || name.length > 80) {
    details.name = 'Please enter your name (2–80 characters).';
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 160) {
    details.email = 'Please enter a valid email address.';
  }
  if (subject.length > 120) {
    details.subject = 'Please keep the subject under 120 characters.';
  }
  if (message.length < 20) {
    details.message = 'Please write at least 20 characters so I can help.';
  } else if (message.length > 4000) {
    details.message = 'Please keep the message under 4000 characters.';
  }

  if (Object.keys(details).length > 0) throw new ValidationError(details);

  return { name, email, subject, message };
}

export function validateBooking(payload = {}) {
  const details = {};
  const name = asString(payload.name);
  const email = asString(payload.email);
  const phone = asString(payload.phone);
  const notes = asString(payload.notes ?? payload.message);
  const date = asString(payload.date);
  const time = asString(payload.time);

  if (name.length < 2 || name.length > 80) {
    details.name = 'Please enter your name (2–80 characters).';
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 160) {
    details.email = 'Please enter a valid email address.';
  }
  if (phone && !PHONE_PATTERN.test(phone)) {
    details.phone = 'Please enter a valid phone number, or leave it blank.';
  }
  if (notes.length > 600) {
    details.notes = 'Please keep notes under 600 characters.';
  }
  if (!date) {
    details.date = 'Please choose a date.';
  }
  if (!time) {
    details.time = 'Please choose a time slot.';
  }

  if (Object.keys(details).length > 0) throw new ValidationError(details);

  return { name, email, phone, notes, date, time };
}

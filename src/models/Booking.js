import mongoose from 'mongoose';

import { schedule } from '../config/schedule.js';

const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'A name is required.'],
      trim: true,
      minlength: [2, 'Please enter at least 2 characters for the name.'],
      maxlength: [80, 'Please keep the name under 80 characters.'],
    },
    email: {
      type: String,
      required: [true, 'An email address is required.'],
      trim: true,
      lowercase: true,
      maxlength: [160, 'Please keep the email under 160 characters.'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [32, 'Please keep the phone number under 32 characters.'],
      default: '',
    },
    // The instant the call starts, stored in UTC. Always recomputed on the
    // server from dateKey + timeKey so a client can never fake the timestamp.
    scheduledAt: {
      type: Date,
      required: true,
    },
    // PKT wall-clock representation, used for display and duplicate detection.
    dateKey: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.'],
    },
    timeKey: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time.'],
    },
    timezone: {
      type: String,
      required: true,
      default: schedule.timezone,
    },
    durationMinutes: {
      type: Number,
      required: true,
      default: schedule.slotMinutes,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [600, 'Please keep notes under 600 characters.'],
      default: '',
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'completed'],
      default: 'confirmed',
      required: true,
    },
    source: {
      type: String,
      default: 'website',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Two visitors racing for the same slot: the database itself rejects the second
// write. Partial so a cancelled booking frees the slot again.
bookingSchema.index(
  { dateKey: 1, timeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'confirmed' },
    name: 'unique_confirmed_slot',
  },
);
bookingSchema.index({ scheduledAt: 1 });
bookingSchema.index({ email: 1, dateKey: 1 });

bookingSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    date: this.dateKey,
    time: this.timeKey,
    scheduledAt: this.scheduledAt.toISOString(),
    timezone: this.timezone,
    durationMinutes: this.durationMinutes,
    status: this.status,
    createdAt: this.createdAt.toISOString(),
  };
};

export const Booking = mongoose.model('Booking', bookingSchema);

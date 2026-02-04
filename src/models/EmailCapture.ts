import { Schema, model } from "mongoose";
import { IEmailCapture } from "../types/index";

const EmailCaptureSchema = new Schema<IEmailCapture>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      validate: {
        validator: function (email: string) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email);
        },
        message: "Please provide a valid email address",
      },
      index: true,
    },
    consentGiven: {
      type: Boolean,
      required: [true, "Consent status is required"],
      validate: {
        validator: function (consent: boolean) {
          return consent === true; // Must be explicitly true
        },
        message: "Consent must be explicitly given",
      },
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
      index: true,
    },
    capturedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      validate: {
        validator: function (ip: string) {
          if (!ip) return true; // Optional field
          // Basic IP validation (IPv4, IPv6, and IPv4-mapped IPv6)
          const ipv4Regex =
            /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;
          const ipv4MappedRegex =
            /^::ffff:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          return (
            ipv4Regex.test(ip) || ipv6Regex.test(ip) || ipv4MappedRegex.test(ip)
          );
        },
        message: "Please provide a valid IP address",
      },
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, "User agent cannot exceed 500 characters"],
    },
  },
  {
    timestamps: false, // We use capturedAt instead
    collection: "emailCaptures",
  },
);

// Compound indexes for performance and analytics
EmailCaptureSchema.index({ eventId: 1, capturedAt: -1 }); // Event analytics
EmailCaptureSchema.index({ email: 1, capturedAt: -1 }); // User activity tracking
EmailCaptureSchema.index({ capturedAt: -1 }); // Time-based queries
EmailCaptureSchema.index({ consentGiven: 1, capturedAt: -1 }); // Consent analytics

// Ensure we don't capture the same email for the same event multiple times
EmailCaptureSchema.index({ email: 1, eventId: 1 }, { unique: true });

// Pre-save middleware
EmailCaptureSchema.pre("save", function (next) {
  // Ensure email is lowercase and trimmed
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }

  // Ensure capturedAt is set
  if (!this.capturedAt) {
    this.capturedAt = new Date();
  }

  next();
});

// Instance methods
EmailCaptureSchema.methods.isValidCapture = function (): boolean {
  return this.consentGiven === true && this.email && this.eventId;
};

EmailCaptureSchema.methods.getAnonymizedData = function () {
  return {
    eventId: this.eventId,
    capturedAt: this.capturedAt,
    consentGiven: this.consentGiven,
    // Email is excluded for privacy
  };
};

// Static methods
EmailCaptureSchema.statics.findByEvent = function (eventId: string) {
  return this.find({ eventId }).sort({ capturedAt: -1 });
};

EmailCaptureSchema.statics.findByEmail = function (email: string) {
  return this.find({ email: email.toLowerCase().trim() }).sort({
    capturedAt: -1,
  });
};

EmailCaptureSchema.statics.getEventStats = function (eventId: string) {
  return this.aggregate([
    { $match: { eventId: new Schema.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: "$eventId",
        totalCaptures: { $sum: 1 },
        uniqueEmails: { $addToSet: "$email" },
        firstCapture: { $min: "$capturedAt" },
        lastCapture: { $max: "$capturedAt" },
      },
    },
    {
      $project: {
        totalCaptures: 1,
        uniqueEmailCount: { $size: "$uniqueEmails" },
        firstCapture: 1,
        lastCapture: 1,
      },
    },
  ]);
};

EmailCaptureSchema.statics.getDailyStats = function (days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    { $match: { capturedAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: "$capturedAt" },
          month: { $month: "$capturedAt" },
          day: { $dayOfMonth: "$capturedAt" },
        },
        count: { $sum: 1 },
        uniqueEmails: { $addToSet: "$email" },
      },
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: "$_id.year",
            month: "$_id.month",
            day: "$_id.day",
          },
        },
        totalCaptures: "$count",
        uniqueEmailCount: { $size: "$uniqueEmails" },
      },
    },
    { $sort: { date: 1 } },
  ]);
};

export const EmailCapture = model<IEmailCapture>(
  "EmailCapture",
  EmailCaptureSchema,
);

import { Schema, model } from "mongoose";
import { IScrapingLog, IScrapingLogModel } from "../types/index";

const ScrapingLogSchema = new Schema<IScrapingLog>(
  {
    sourceWebsite: {
      type: String,
      required: [true, "Source website is required"],
      trim: true,
      validate: {
        validator: function (url: string) {
          const urlRegex = /^https?:\/\/.+/;
          return urlRegex.test(url);
        },
        message: "Source website must be a valid HTTP/HTTPS URL",
      },
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
      index: true,
    },
    endTime: {
      type: Date,
      index: true,
    },
    eventsFound: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Events found cannot be negative"],
    },
    eventsProcessed: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Events processed cannot be negative"],
    },
    scrapingErrors: {
      type: [String],
      default: [],
      validate: {
        validator: function (errors: string[]) {
          return errors.length <= 100; // Reasonable limit
        },
        message: "Cannot store more than 100 error messages",
      },
    },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      required: [true, "Status is required"],
      default: "running",
      index: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: "scrapingLogs",
  },
);

// Compound indexes for performance
ScrapingLogSchema.index({ sourceWebsite: 1, startTime: -1 }); // Source-specific queries
ScrapingLogSchema.index({ status: 1, startTime: -1 }); // Status-based queries
ScrapingLogSchema.index({ startTime: -1 }); // Recent activity queries

// Pre-save middleware
ScrapingLogSchema.pre("save", function (next) {
  // Validate that endTime is after startTime if both are set
  if (this.endTime && this.startTime && this.endTime < this.startTime) {
    return next(new Error("End time cannot be before start time"));
  }

  // Auto-set endTime when status changes to completed or failed
  if (
    (this.status === "completed" || this.status === "failed") &&
    !this.endTime
  ) {
    this.endTime = new Date();
  }

  // Ensure eventsProcessed doesn't exceed eventsFound
  if (this.eventsProcessed > this.eventsFound) {
    return next(new Error("Events processed cannot exceed events found"));
  }

  next();
});

// Instance methods
ScrapingLogSchema.methods.getDuration = function (): number | null {
  if (!this.endTime) return null;
  return this.endTime.getTime() - this.startTime.getTime();
};

ScrapingLogSchema.methods.getSuccessRate = function (): number {
  if (this.eventsFound === 0) return 0;
  return (this.eventsProcessed / this.eventsFound) * 100;
};

ScrapingLogSchema.methods.addError = function (error: string) {
  if (this.scrapingErrors.length < 100) {
    this.scrapingErrors.push(error);
  }
  return this.save();
};

ScrapingLogSchema.methods.markCompleted = function (
  eventsFound: number,
  eventsProcessed: number,
) {
  this.status = "completed";
  this.endTime = new Date();
  this.eventsFound = eventsFound;
  this.eventsProcessed = eventsProcessed;
  return this.save();
};

ScrapingLogSchema.methods.markFailed = function (error: string) {
  this.status = "failed";
  this.endTime = new Date();
  if (error) {
    this.addError(error);
  }
  return this.save();
};

// Static methods
ScrapingLogSchema.statics.findBySource = function (sourceWebsite: string) {
  return this.find({ sourceWebsite }).sort({ startTime: -1 });
};

ScrapingLogSchema.statics.findRecent = function (hours: number = 24) {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);
  return this.find({ startTime: { $gte: cutoff } }).sort({ startTime: -1 });
};

ScrapingLogSchema.statics.findByStatus = function (
  status: "running" | "completed" | "failed",
) {
  return this.find({ status }).sort({ startTime: -1 });
};

ScrapingLogSchema.statics.getSourceStats = function (
  sourceWebsite: string,
  days: number = 30,
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        sourceWebsite,
        startTime: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: "$sourceWebsite",
        totalRuns: { $sum: 1 },
        successfulRuns: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        failedRuns: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        totalEventsFound: { $sum: "$eventsFound" },
        totalEventsProcessed: { $sum: "$eventsProcessed" },
        avgDuration: {
          $avg: {
            $cond: [
              { $ne: ["$endTime", null] },
              { $subtract: ["$endTime", "$startTime"] },
              null,
            ],
          },
        },
        lastRun: { $max: "$startTime" },
      },
    },
    {
      $project: {
        sourceWebsite: "$_id",
        totalRuns: 1,
        successfulRuns: 1,
        failedRuns: 1,
        successRate: {
          $cond: [
            { $eq: ["$totalRuns", 0] },
            0,
            {
              $multiply: [{ $divide: ["$successfulRuns", "$totalRuns"] }, 100],
            },
          ],
        },
        totalEventsFound: 1,
        totalEventsProcessed: 1,
        processingRate: {
          $cond: [
            { $eq: ["$totalEventsFound", 0] },
            0,
            {
              $multiply: [
                { $divide: ["$totalEventsProcessed", "$totalEventsFound"] },
                100,
              ],
            },
          ],
        },
        avgDurationMinutes: {
          $cond: [
            { $ne: ["$avgDuration", null] },
            { $divide: ["$avgDuration", 60000] }, // Convert ms to minutes
            null,
          ],
        },
        lastRun: 1,
      },
    },
  ]);
};

ScrapingLogSchema.statics.createLog = function (sourceWebsite: string) {
  return this.create({
    sourceWebsite,
    startTime: new Date(),
    status: "running",
  });
};

export const ScrapingLog = model<IScrapingLog, IScrapingLogModel>(
  "ScrapingLog",
  ScrapingLogSchema,
);

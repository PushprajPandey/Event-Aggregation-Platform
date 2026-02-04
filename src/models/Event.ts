import { Schema, model } from "mongoose";
import { IEvent, EventStatus } from "../types/index";

const EventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    dateTime: {
      type: Date,
      required: [true, "Event date and time is required"],
      index: true,
    },
    venueName: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
      maxlength: [150, "Venue name cannot exceed 150 characters"],
    },
    venueAddress: {
      type: String,
      trim: true,
      maxlength: [300, "Venue address cannot exceed 300 characters"],
    },
    city: {
      type: String,
      required: true,
      default: "Sydney",
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    categoryTags: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags: string[]) {
          return tags.length <= 10;
        },
        message: "Cannot have more than 10 category tags",
      },
    },
    imageUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function (url: string) {
          if (!url) return true; // Optional field
          const urlRegex = /^https?:\/\/.+/;
          return urlRegex.test(url);
        },
        message: "Image URL must be a valid HTTP/HTTPS URL",
      },
    },
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
    },
    originalEventUrl: {
      type: String,
      required: [true, "Original event URL is required"],
      trim: true,
      validate: {
        validator: function (url: string) {
          const urlRegex = /^https?:\/\/.+/;
          return urlRegex.test(url);
        },
        message: "Original event URL must be a valid HTTP/HTTPS URL",
      },
    },
    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.NEW,
      required: true,
      index: true,
    },
    lastScrapedAt: {
      type: Date,
      required: [true, "Last scraped timestamp is required"],
      index: true,
    },
    importedAt: {
      type: Date,
      index: true,
    },
    importedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    importNotes: {
      type: String,
      trim: true,
      maxlength: [500, "Import notes cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: "events",
  },
);

// Compound indexes for performance
EventSchema.index({ city: 1, dateTime: 1 }); // Location and date filtering
EventSchema.index({ status: 1, lastScrapedAt: -1 }); // Admin dashboard queries
EventSchema.index(
  {
    title: "text",
    description: "text",
    venueName: "text",
  },
  {
    weights: {
      title: 10,
      venueName: 5,
      description: 1,
    },
    name: "event_search_index",
  },
); // Full-text search

// Ensure unique events based on original URL and source
EventSchema.index({ originalEventUrl: 1, sourceWebsite: 1 }, { unique: true });

// Pre-save middleware to ensure data consistency
EventSchema.pre("save", function (next) {
  // Ensure city defaults to Sydney if not provided
  if (!this.city) {
    this.city = "Sydney";
  }

  // Trim category tags and remove duplicates
  if (this.categoryTags && this.categoryTags.length > 0) {
    this.categoryTags = [
      ...new Set(this.categoryTags.map((tag) => tag.trim().toLowerCase())),
    ];
  }

  next();
});

// Instance methods
EventSchema.methods.canBeImported = function (): boolean {
  return this.status !== EventStatus.IMPORTED;
};

EventSchema.methods.markAsImported = function (userId: string, notes?: string) {
  this.status = EventStatus.IMPORTED;
  this.importedAt = new Date();
  this.importedBy = userId;
  if (notes) {
    this.importNotes = notes;
  }
  return this.save();
};

// Static methods
EventSchema.statics.findByCity = function (city: string) {
  return this.find({ city: new RegExp(city, "i") });
};

EventSchema.statics.findUpcoming = function (limit: number = 50) {
  return this.find({ dateTime: { $gte: new Date() } })
    .sort({ dateTime: 1 })
    .limit(limit);
};

EventSchema.statics.findByStatus = function (status: EventStatus) {
  return this.find({ status });
};

export const Event = model<IEvent>("Event", EventSchema);

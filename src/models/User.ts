import { Schema, model } from "mongoose";
import { IUser, IUserModel } from "../types/index";

const UserSchema = new Schema<IUser>(
  {
    googleId: {
      type: String,
      required: [true, "Google ID is required"],
      unique: true,
      trim: true,
      index: true,
    },
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
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    profilePicture: {
      type: String,
      trim: true,
      validate: {
        validator: function (url: string) {
          if (!url) return true; // Optional field
          const urlRegex = /^https?:\/\/.+/;
          return urlRegex.test(url);
        },
        message: "Profile picture must be a valid HTTP/HTTPS URL",
      },
    },
    lastLoginAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: "users",
  },
);

// Indexes for performance
UserSchema.index({ googleId: 1 }, { unique: true }); // OAuth lookup
UserSchema.index({ email: 1 }); // Email lookup
UserSchema.index({ lastLoginAt: -1 }); // Recent activity queries

// Pre-save middleware
UserSchema.pre("save", function (next) {
  // Ensure email is lowercase
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }

  // Trim and validate name
  if (this.name) {
    this.name = this.name.trim();
  }

  next();
});

// Instance methods
UserSchema.methods.updateLastLogin = function () {
  this.lastLoginAt = new Date();
  return this.save();
};

UserSchema.methods.getDisplayName = function (): string {
  return this.name || this.email.split("@")[0];
};

// Static methods
UserSchema.statics.findByGoogleId = function (googleId: string) {
  return this.findOne({ googleId });
};

UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

UserSchema.statics.createFromGoogleProfile = function (profile: any) {
  return this.create({
    googleId: profile.id,
    email: profile.emails[0].value,
    name: profile.displayName,
    profilePicture: profile.photos[0]?.value,
    lastLoginAt: new Date(),
  });
};

export const User = model<IUser, IUserModel>("User", UserSchema);

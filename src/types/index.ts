import { Document, Types, Model, Query, Aggregate } from "mongoose";

// Core Event Data Interface
export interface EventData {
  title: string;
  dateTime: Date;
  venueName: string;
  venueAddress?: string;
  city: string;
  description: string;
  categoryTags: string[];
  imageUrl?: string;
  sourceWebsite: string;
  originalEventUrl: string;
  lastScrapedAt: Date;
}

// Event Status Enum
export enum EventStatus {
  NEW = "new",
  UPDATED = "updated",
  INACTIVE = "inactive",
  IMPORTED = "imported",
}

// Event Document Interface (MongoDB)
export interface IEvent extends Document {
  _id: Types.ObjectId;
  title: string;
  dateTime: Date;
  venueName: string;
  venueAddress?: string;
  city: string;
  description: string;
  categoryTags: string[];
  imageUrl?: string;
  sourceWebsite: string;
  originalEventUrl: string;
  status: EventStatus;
  lastScrapedAt: Date;
  importedAt?: Date;
  importedBy?: Types.ObjectId;
  importNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// User Document Interface (MongoDB)
export interface IUser extends Document {
  _id: Types.ObjectId;
  googleId: string;
  email: string;
  name: string;
  profilePicture?: string;
  createdAt: Date;
  lastLoginAt?: Date;

  // Instance methods
  updateLastLogin(): Promise<IUser>;
  getDisplayName(): string;
}

// User Model Interface (for static methods)
export interface IUserModel extends Model<IUser> {
  findByGoogleId(googleId: string): Query<IUser | null, IUser>;
  findByEmail(email: string): Query<IUser | null, IUser>;
  createFromGoogleProfile(profile: any): Promise<IUser>;
}

// Email Capture Document Interface (MongoDB)
export interface IEmailCapture extends Document {
  _id: Types.ObjectId;
  email: string;
  consentGiven: boolean;
  eventId: Types.ObjectId;
  capturedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Scraping Log Document Interface (MongoDB)
export interface IScrapingLog extends Document {
  _id: Types.ObjectId;
  sourceWebsite: string;
  startTime: Date;
  endTime?: Date;
  eventsFound: number;
  eventsProcessed: number;
  scrapingErrors: string[];
  status: "running" | "completed" | "failed";
  createdAt: Date;

  // Instance methods
  getDuration(): number | null;
  getSuccessRate(): number;
  addError(error: string): Promise<IScrapingLog>;
  markCompleted(
    eventsFound: number,
    eventsProcessed: number,
  ): Promise<IScrapingLog>;
  markFailed(error: string): Promise<IScrapingLog>;
}

// Scraping Log Model Interface (for static methods)
export interface IScrapingLogModel extends Model<IScrapingLog> {
  findBySource(sourceWebsite: string): Query<IScrapingLog[], IScrapingLog>;
  findRecent(hours?: number): Query<IScrapingLog[], IScrapingLog>;
  findByStatus(
    status: "running" | "completed" | "failed",
  ): Query<IScrapingLog[], IScrapingLog>;
  getSourceStats(sourceWebsite: string, days?: number): Aggregate<any[]>;
  createLog(sourceWebsite: string): Promise<IScrapingLog>;
}

// Scraping Result Interface
export interface ScrapingResult {
  events: EventData[];
  scrapingErrors: ScrapingError[];
  sourceUrl: string;
  scrapedAt: Date;
}

// Scraping Error Interface
export interface ScrapingError {
  message: string;
  url?: string;
  stack?: string;
  timestamp: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Event Filter Interface
export interface EventFilter {
  city?: string;
  keyword?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: EventStatus;
  limit?: number;
  offset?: number;
}

// Email Capture Request Interface
export interface EmailCaptureRequest {
  email: string;
  consentGiven: boolean;
  eventId: string;
}

// Event Import Request Interface
export interface EventImportRequest {
  eventId: string;
  importNotes?: string;
}

// Dashboard Stats Interface
export interface DashboardStats {
  totalEvents: number;
  newEvents: number;
  updatedEvents: number;
  inactiveEvents: number;
  importedEvents: number;
  lastScrapingTime?: Date;
}

// Express Session User Interface
declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

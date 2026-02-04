// Export all MongoDB models
export { Event } from "./Event";
export { User } from "./User";
export { EmailCapture } from "./EmailCapture";
export { ScrapingLog } from "./ScrapingLog";

// Re-export types for convenience
export type {
  IEvent,
  IUser,
  IEmailCapture,
  IScrapingLog,
} from "../types/index";
export { EventStatus } from "../types/index";

import { Event } from "../models/Event";
import { EventData, EventStatus, IEvent } from "../types";
import { Types } from "mongoose";

/**
 * Interface for status change logging
 */
export interface StatusChangeLog {
  eventId: Types.ObjectId;
  previousStatus: EventStatus;
  newStatus: EventStatus;
  reason: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Interface for change detection result
 */
export interface ChangeDetectionResult {
  newEvents: EventData[];
  updatedEvents: Array<{ existing: IEvent; updated: EventData }>;
  inactiveEvents: IEvent[];
  statusChanges: StatusChangeLog[];
}

/**
 * Status Manager class for event lifecycle tracking
 * Handles status transitions, change detection, and validation
 */
export class StatusManager {
  private logger: (message: string, level?: "info" | "warn" | "error") => void;
  private statusChangeLogs: StatusChangeLog[] = [];

  constructor(
    logger?: (message: string, level?: "info" | "warn" | "error") => void,
  ) {
    this.logger = logger || this.defaultLogger;
  }

  /**
   * Default logger implementation
   */
  private defaultLogger(
    message: string,
    level: "info" | "warn" | "error" = "info",
  ): void {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [STATUS_MANAGER] [${level.toUpperCase()}] ${message}`,
    );
  }

  /**
   * Process scraped events and detect changes
   * This is the main method that orchestrates change detection and status updates
   */
  async processScrapedEvents(
    scrapedEvents: EventData[],
    sourceWebsite: string,
  ): Promise<ChangeDetectionResult> {
    this.logger(
      `Processing ${scrapedEvents.length} scraped events from ${sourceWebsite}`,
      "info",
    );

    const result: ChangeDetectionResult = {
      newEvents: [],
      updatedEvents: [],
      inactiveEvents: [],
      statusChanges: [],
    };

    try {
      // Get all existing events from this source
      const existingEvents = await Event.find({ sourceWebsite });
      this.logger(
        `Found ${existingEvents.length} existing events from ${sourceWebsite}`,
        "info",
      );

      // Create maps for efficient lookup
      const existingEventMap = new Map<string, IEvent>();
      const scrapedEventMap = new Map<string, EventData>();

      // Build existing events map using originalEventUrl as key
      existingEvents.forEach((event) => {
        existingEventMap.set(event.originalEventUrl, event);
      });

      // Build scraped events map using originalEventUrl as key
      scrapedEvents.forEach((event) => {
        scrapedEventMap.set(event.originalEventUrl, event);
      });

      // Detect new and updated events
      for (const scrapedEvent of scrapedEvents) {
        const existingEvent = existingEventMap.get(
          scrapedEvent.originalEventUrl,
        );

        if (!existingEvent) {
          // This is a new event
          result.newEvents.push(scrapedEvent);
          this.logger(`New event detected: ${scrapedEvent.title}`, "info");
        } else {
          // Check if the event has been updated
          const hasChanges = this.detectEventChanges(
            existingEvent,
            scrapedEvent,
          );
          if (hasChanges) {
            result.updatedEvents.push({
              existing: existingEvent,
              updated: scrapedEvent,
            });
            this.logger(
              `Updated event detected: ${scrapedEvent.title}`,
              "info",
            );
          } else {
            // Event exists but no changes - just update lastScrapedAt
            existingEvent.lastScrapedAt = new Date();
            await existingEvent.save();
          }
        }
      }

      // Detect inactive events (events that exist in DB but not in scraped data)
      for (const existingEvent of existingEvents) {
        if (!scrapedEventMap.has(existingEvent.originalEventUrl)) {
          // Only mark as inactive if it's not already inactive or imported
          if (
            existingEvent.status !== EventStatus.INACTIVE &&
            existingEvent.status !== EventStatus.IMPORTED
          ) {
            result.inactiveEvents.push(existingEvent);
            this.logger(
              `Inactive event detected: ${existingEvent.title}`,
              "info",
            );
          }
        }
      }

      // Apply status changes
      await this.applyStatusChanges(result);

      this.logger(
        `Change detection completed: ${result.newEvents.length} new, ${result.updatedEvents.length} updated, ${result.inactiveEvents.length} inactive`,
        "info",
      );

      return result;
    } catch (error) {
      this.logger(
        `Error processing scraped events: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
      throw error;
    }
  }

  /**
   * Detect if an event has changes by comparing key fields
   */
  private detectEventChanges(existing: IEvent, scraped: EventData): boolean {
    // Compare key fields that indicate content changes
    const fieldsToCompare = [
      "title",
      "dateTime",
      "venueName",
      "venueAddress",
      "description",
      "imageUrl",
    ] as const;

    for (const field of fieldsToCompare) {
      const existingValue = existing[field];
      const scrapedValue = scraped[field];

      // Handle date comparison specially
      if (field === "dateTime") {
        const existingTime =
          existingValue instanceof Date ? existingValue.getTime() : 0;
        const scrapedTime =
          scrapedValue instanceof Date ? scrapedValue.getTime() : 0;
        if (existingTime !== scrapedTime) {
          return true;
        }
      } else {
        // String comparison (handle undefined/null)
        const existingStr = existingValue?.toString() || "";
        const scrapedStr = scrapedValue?.toString() || "";
        if (existingStr !== scrapedStr) {
          return true;
        }
      }
    }

    // Compare category tags array
    const existingTags = existing.categoryTags || [];
    const scrapedTags = scraped.categoryTags || [];
    if (
      existingTags.length !== scrapedTags.length ||
      !existingTags.every((tag, index) => tag === scrapedTags[index])
    ) {
      return true;
    }

    return false;
  }

  /**
   * Apply status changes based on detection results
   */
  private async applyStatusChanges(
    result: ChangeDetectionResult,
  ): Promise<void> {
    // Create new events with "new" status
    for (const newEventData of result.newEvents) {
      try {
        const newEvent = new Event({
          ...newEventData,
          status: EventStatus.NEW,
        });
        await newEvent.save();

        const statusChange: StatusChangeLog = {
          eventId: newEvent._id,
          previousStatus: EventStatus.NEW, // No previous status for new events
          newStatus: EventStatus.NEW,
          reason: "Event created from scraping",
          timestamp: new Date(),
          metadata: {
            sourceWebsite: newEventData.sourceWebsite,
          },
        };
        result.statusChanges.push(statusChange);
        this.statusChangeLogs.push(statusChange);
      } catch (error) {
        this.logger(
          `Error creating new event: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );
      }
    }

    // Update existing events and change status to "updated"
    for (const { existing, updated } of result.updatedEvents) {
      try {
        const previousStatus = existing.status;

        // Update event data
        Object.assign(existing, {
          ...updated,
          status: EventStatus.UPDATED,
          lastScrapedAt: new Date(),
        });

        await existing.save();

        const statusChange: StatusChangeLog = {
          eventId: existing._id,
          previousStatus,
          newStatus: EventStatus.UPDATED,
          reason: "Event data changed during scraping",
          timestamp: new Date(),
          metadata: {
            sourceWebsite: updated.sourceWebsite,
          },
        };
        result.statusChanges.push(statusChange);
        this.statusChangeLogs.push(statusChange);
      } catch (error) {
        this.logger(
          `Error updating event: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );
      }
    }

    // Mark events as inactive
    for (const inactiveEvent of result.inactiveEvents) {
      try {
        const previousStatus = inactiveEvent.status;
        inactiveEvent.status = EventStatus.INACTIVE;
        inactiveEvent.lastScrapedAt = new Date();
        await inactiveEvent.save();

        const statusChange: StatusChangeLog = {
          eventId: inactiveEvent._id,
          previousStatus,
          newStatus: EventStatus.INACTIVE,
          reason: "Event no longer found on source website",
          timestamp: new Date(),
          metadata: {
            sourceWebsite: inactiveEvent.sourceWebsite,
          },
        };
        result.statusChanges.push(statusChange);
        this.statusChangeLogs.push(statusChange);
      } catch (error) {
        this.logger(
          `Error marking event as inactive: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );
      }
    }
  }

  /**
   * Validate status transition according to business rules
   */
  validateStatusTransition(
    currentStatus: EventStatus,
    newStatus: EventStatus,
  ): { valid: boolean; reason?: string } {
    // Define valid status transitions
    const validTransitions: Record<EventStatus, EventStatus[]> = {
      [EventStatus.NEW]: [
        EventStatus.UPDATED,
        EventStatus.INACTIVE,
        EventStatus.IMPORTED,
      ],
      [EventStatus.UPDATED]: [EventStatus.INACTIVE, EventStatus.IMPORTED],
      [EventStatus.INACTIVE]: [EventStatus.IMPORTED],
      [EventStatus.IMPORTED]: [], // Terminal state - no transitions allowed
    };

    const allowedTransitions = validTransitions[currentStatus] || [];

    if (allowedTransitions.includes(newStatus)) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Invalid transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedTransitions.join(", ")}`,
    };
  }

  /**
   * Import an event (change status to imported)
   */
  async importEvent(
    eventId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    importNotes?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        return { success: false, error: "Event not found" };
      }

      // Validate status transition
      const validation = this.validateStatusTransition(
        event.status,
        EventStatus.IMPORTED,
      );
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }

      const previousStatus = event.status;

      // Update event status
      event.status = EventStatus.IMPORTED;
      event.importedAt = new Date();
      event.importedBy = new Types.ObjectId(userId);
      if (importNotes) {
        event.importNotes = importNotes;
      }

      await event.save();

      // Log status change
      const statusChange: StatusChangeLog = {
        eventId: event._id,
        previousStatus,
        newStatus: EventStatus.IMPORTED,
        reason: "Event manually imported by admin",
        timestamp: new Date(),
        metadata: {
          userId: userId.toString(),
          importNotes,
        },
      };
      this.statusChangeLogs.push(statusChange);

      this.logger(
        `Event imported successfully: ${event.title} (ID: ${eventId})`,
        "info",
      );

      return { success: true };
    } catch (error) {
      const errorMessage = `Error importing event: ${error instanceof Error ? error.message : "Unknown error"}`;
      this.logger(errorMessage, "error");
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get status change logs
   */
  getStatusChangeLogs(limit?: number): StatusChangeLog[] {
    const logs = [...this.statusChangeLogs].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Get events by status
   */
  async getEventsByStatus(status: EventStatus): Promise<IEvent[]> {
    try {
      return await Event.find({ status }).sort({ lastScrapedAt: -1 });
    } catch (error) {
      this.logger(
        `Error fetching events by status ${status}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
      return [];
    }
  }

  /**
   * Get status statistics
   */
  async getStatusStatistics(): Promise<Record<EventStatus, number>> {
    try {
      const pipeline = [
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ];

      const results = await Event.aggregate(pipeline);
      const stats: Record<EventStatus, number> = {
        [EventStatus.NEW]: 0,
        [EventStatus.UPDATED]: 0,
        [EventStatus.INACTIVE]: 0,
        [EventStatus.IMPORTED]: 0,
      };

      results.forEach((result) => {
        if (result._id in stats) {
          stats[result._id as EventStatus] = result.count;
        }
      });

      return stats;
    } catch (error) {
      this.logger(
        `Error fetching status statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
      return {
        [EventStatus.NEW]: 0,
        [EventStatus.UPDATED]: 0,
        [EventStatus.INACTIVE]: 0,
        [EventStatus.IMPORTED]: 0,
      };
    }
  }

  /**
   * Clear status change logs (useful for testing)
   */
  clearStatusChangeLogs(): void {
    this.statusChangeLogs = [];
  }
}

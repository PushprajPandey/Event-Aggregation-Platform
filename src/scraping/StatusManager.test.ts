import {
  StatusManager,
  StatusChangeLog,
  ChangeDetectionResult,
} from "./StatusManager";
import { Event } from "../models/Event";
import { EventData, EventStatus, IEvent } from "../types";
import { Types } from "mongoose";

// Mock the Event model
jest.mock("../models/Event");
const MockedEvent = Event as jest.Mocked<typeof Event>;

describe("StatusManager", () => {
  let statusManager: StatusManager;
  let mockLogger: jest.Mock;

  beforeEach(() => {
    mockLogger = jest.fn();
    statusManager = new StatusManager(mockLogger);
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with custom logger", () => {
      expect(mockLogger).not.toHaveBeenCalled();
    });

    it("should initialize with default logger when none provided", () => {
      const manager = new StatusManager();
      expect(manager).toBeInstanceOf(StatusManager);
    });
  });

  describe("validateStatusTransition", () => {
    it("should allow valid transitions from NEW status", () => {
      const validTransitions = [
        EventStatus.UPDATED,
        EventStatus.INACTIVE,
        EventStatus.IMPORTED,
      ];

      validTransitions.forEach((newStatus) => {
        const result = statusManager.validateStatusTransition(
          EventStatus.NEW,
          newStatus,
        );
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    it("should allow valid transitions from UPDATED status", () => {
      const validTransitions = [EventStatus.INACTIVE, EventStatus.IMPORTED];

      validTransitions.forEach((newStatus) => {
        const result = statusManager.validateStatusTransition(
          EventStatus.UPDATED,
          newStatus,
        );
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    it("should allow valid transitions from INACTIVE status", () => {
      const result = statusManager.validateStatusTransition(
        EventStatus.INACTIVE,
        EventStatus.IMPORTED,
      );
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should reject transitions from IMPORTED status", () => {
      const invalidTransitions = [
        EventStatus.NEW,
        EventStatus.UPDATED,
        EventStatus.INACTIVE,
      ];

      invalidTransitions.forEach((newStatus) => {
        const result = statusManager.validateStatusTransition(
          EventStatus.IMPORTED,
          newStatus,
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("Invalid transition");
      });
    });

    it("should reject invalid transitions", () => {
      // NEW cannot go back to NEW
      const result = statusManager.validateStatusTransition(
        EventStatus.NEW,
        EventStatus.NEW,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Invalid transition");
    });
  });

  describe("detectEventChanges", () => {
    const createMockEvent = (overrides: Partial<IEvent> = {}): IEvent =>
      ({
        _id: new Types.ObjectId(),
        title: "Original Title",
        dateTime: new Date("2024-01-01T10:00:00Z"),
        venueName: "Original Venue",
        venueAddress: "Original Address",
        city: "Sydney",
        description: "Original Description",
        categoryTags: ["music", "concert"],
        imageUrl: "https://example.com/original.jpg",
        sourceWebsite: "Test Source",
        originalEventUrl: "https://example.com/event",
        status: EventStatus.NEW,
        lastScrapedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      }) as IEvent;

    it("should detect title changes", () => {
      const existingEvent = createMockEvent();
      const scrapedEvent: EventData = {
        title: "Updated Title", // Changed
        dateTime: existingEvent.dateTime,
        venueName: existingEvent.venueName,
        venueAddress: existingEvent.venueAddress,
        city: existingEvent.city,
        description: existingEvent.description,
        categoryTags: existingEvent.categoryTags,
        imageUrl: existingEvent.imageUrl,
        sourceWebsite: existingEvent.sourceWebsite,
        originalEventUrl: existingEvent.originalEventUrl,
        lastScrapedAt: new Date(),
      };

      const hasChanges = (statusManager as any).detectEventChanges(
        existingEvent,
        scrapedEvent,
      );
      expect(hasChanges).toBe(true);
    });

    it("should detect date changes", () => {
      const existingEvent = createMockEvent();
      const scrapedEvent: EventData = {
        title: existingEvent.title,
        dateTime: new Date("2024-01-02T10:00:00Z"), // Changed
        venueName: existingEvent.venueName,
        venueAddress: existingEvent.venueAddress,
        city: existingEvent.city,
        description: existingEvent.description,
        categoryTags: existingEvent.categoryTags,
        imageUrl: existingEvent.imageUrl,
        sourceWebsite: existingEvent.sourceWebsite,
        originalEventUrl: existingEvent.originalEventUrl,
        lastScrapedAt: new Date(),
      };

      const hasChanges = (statusManager as any).detectEventChanges(
        existingEvent,
        scrapedEvent,
      );
      expect(hasChanges).toBe(true);
    });

    it("should detect category tag changes", () => {
      const existingEvent = createMockEvent();
      const scrapedEvent: EventData = {
        title: existingEvent.title,
        dateTime: existingEvent.dateTime,
        venueName: existingEvent.venueName,
        venueAddress: existingEvent.venueAddress,
        city: existingEvent.city,
        description: existingEvent.description,
        categoryTags: ["music", "festival"], // Changed
        imageUrl: existingEvent.imageUrl,
        sourceWebsite: existingEvent.sourceWebsite,
        originalEventUrl: existingEvent.originalEventUrl,
        lastScrapedAt: new Date(),
      };

      const hasChanges = (statusManager as any).detectEventChanges(
        existingEvent,
        scrapedEvent,
      );
      expect(hasChanges).toBe(true);
    });

    it("should return false when no changes detected", () => {
      const existingEvent = createMockEvent();
      const scrapedEvent: EventData = {
        title: existingEvent.title,
        dateTime: existingEvent.dateTime,
        venueName: existingEvent.venueName,
        venueAddress: existingEvent.venueAddress,
        city: existingEvent.city,
        description: existingEvent.description,
        categoryTags: existingEvent.categoryTags,
        imageUrl: existingEvent.imageUrl,
        sourceWebsite: existingEvent.sourceWebsite,
        originalEventUrl: existingEvent.originalEventUrl,
        lastScrapedAt: new Date(),
      };

      const hasChanges = (statusManager as any).detectEventChanges(
        existingEvent,
        scrapedEvent,
      );
      expect(hasChanges).toBe(false);
    });
  });

  describe("importEvent", () => {
    it("should successfully import an event", async () => {
      const eventId = new Types.ObjectId();
      const userId = new Types.ObjectId();
      const importNotes = "Test import notes";

      const mockEvent = {
        _id: eventId,
        status: EventStatus.NEW,
        save: jest.fn().mockResolvedValue(true),
      } as any;

      MockedEvent.findById = jest.fn().mockResolvedValue(mockEvent);

      const result = await statusManager.importEvent(
        eventId,
        userId,
        importNotes,
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockEvent.status).toBe(EventStatus.IMPORTED);
      expect(mockEvent.importedBy).toEqual(userId);
      expect(mockEvent.importNotes).toBe(importNotes);
      expect(mockEvent.importedAt).toBeInstanceOf(Date);
      expect(mockEvent.save).toHaveBeenCalled();
    });

    it("should fail when event not found", async () => {
      const eventId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      MockedEvent.findById = jest.fn().mockResolvedValue(null);

      const result = await statusManager.importEvent(eventId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Event not found");
    });

    it("should fail when status transition is invalid", async () => {
      const eventId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const mockEvent = {
        _id: eventId,
        status: EventStatus.IMPORTED, // Already imported
      } as any;

      MockedEvent.findById = jest.fn().mockResolvedValue(mockEvent);

      const result = await statusManager.importEvent(eventId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });

    it("should handle database errors", async () => {
      const eventId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const mockEvent = {
        _id: eventId,
        status: EventStatus.NEW,
        save: jest.fn().mockRejectedValue(new Error("Database error")),
      } as any;

      MockedEvent.findById = jest.fn().mockResolvedValue(mockEvent);

      const result = await statusManager.importEvent(eventId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
    });
  });

  describe("getEventsByStatus", () => {
    it("should return events filtered by status", async () => {
      const mockEvents = [
        { _id: new Types.ObjectId(), status: EventStatus.NEW },
        { _id: new Types.ObjectId(), status: EventStatus.NEW },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
      };
      mockQuery.sort.mockResolvedValue(mockEvents);

      MockedEvent.find = jest.fn().mockReturnValue(mockQuery);

      const result = await statusManager.getEventsByStatus(EventStatus.NEW);

      expect(MockedEvent.find).toHaveBeenCalledWith({
        status: EventStatus.NEW,
      });
      expect(mockQuery.sort).toHaveBeenCalledWith({ lastScrapedAt: -1 });
      expect(result).toEqual(mockEvents);
    });

    it("should handle database errors gracefully", async () => {
      MockedEvent.find = jest.fn().mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await statusManager.getEventsByStatus(EventStatus.NEW);

      expect(result).toEqual([]);
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching events by status"),
        "error",
      );
    });
  });

  describe("getStatusStatistics", () => {
    it("should return correct status statistics", async () => {
      const mockAggregateResult = [
        { _id: EventStatus.NEW, count: 5 },
        { _id: EventStatus.UPDATED, count: 3 },
        { _id: EventStatus.IMPORTED, count: 2 },
      ];

      MockedEvent.aggregate = jest.fn().mockResolvedValue(mockAggregateResult);

      const result = await statusManager.getStatusStatistics();

      expect(result).toEqual({
        [EventStatus.NEW]: 5,
        [EventStatus.UPDATED]: 3,
        [EventStatus.INACTIVE]: 0,
        [EventStatus.IMPORTED]: 2,
      });
    });

    it("should handle database errors gracefully", async () => {
      MockedEvent.aggregate = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      const result = await statusManager.getStatusStatistics();

      expect(result).toEqual({
        [EventStatus.NEW]: 0,
        [EventStatus.UPDATED]: 0,
        [EventStatus.INACTIVE]: 0,
        [EventStatus.IMPORTED]: 0,
      });
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching status statistics"),
        "error",
      );
    });
  });

  describe("getStatusChangeLogs", () => {
    it("should return status change logs sorted by timestamp", () => {
      const logs: StatusChangeLog[] = [
        {
          eventId: new Types.ObjectId(),
          previousStatus: EventStatus.NEW,
          newStatus: EventStatus.UPDATED,
          reason: "Event updated",
          timestamp: new Date("2024-01-01T10:00:00Z"),
        },
        {
          eventId: new Types.ObjectId(),
          previousStatus: EventStatus.UPDATED,
          newStatus: EventStatus.IMPORTED,
          reason: "Event imported",
          timestamp: new Date("2024-01-02T10:00:00Z"),
        },
      ];

      // Add logs to the manager
      (statusManager as any).statusChangeLogs = logs;

      const result = statusManager.getStatusChangeLogs();

      expect(result).toHaveLength(2);
      // Should be sorted by timestamp descending (newest first)
      expect(result[0].timestamp.getTime()).toBeGreaterThan(
        result[1].timestamp.getTime(),
      );
    });

    it("should limit results when limit parameter provided", () => {
      const logs: StatusChangeLog[] = Array(5)
        .fill(null)
        .map((_, index) => ({
          eventId: new Types.ObjectId(),
          previousStatus: EventStatus.NEW,
          newStatus: EventStatus.UPDATED,
          reason: `Event ${index}`,
          timestamp: new Date(Date.now() + index * 1000),
        }));

      (statusManager as any).statusChangeLogs = logs;

      const result = statusManager.getStatusChangeLogs(3);

      expect(result).toHaveLength(3);
    });
  });

  describe("clearStatusChangeLogs", () => {
    it("should clear all status change logs", () => {
      const logs: StatusChangeLog[] = [
        {
          eventId: new Types.ObjectId(),
          previousStatus: EventStatus.NEW,
          newStatus: EventStatus.UPDATED,
          reason: "Test",
          timestamp: new Date(),
        },
      ];

      (statusManager as any).statusChangeLogs = logs;
      expect((statusManager as any).statusChangeLogs).toHaveLength(1);

      statusManager.clearStatusChangeLogs();

      expect((statusManager as any).statusChangeLogs).toHaveLength(0);
    });
  });
});

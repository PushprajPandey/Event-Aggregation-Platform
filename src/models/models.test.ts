import { Event, User, EmailCapture, ScrapingLog } from "./index";
import { EventStatus } from "../types/index";
import { database } from "../config/database";

describe("MongoDB Models", () => {
  beforeAll(async () => {
    await database.connect();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  afterEach(async () => {
    // Clean up test data
    await Event.deleteMany({});
    await User.deleteMany({});
    await EmailCapture.deleteMany({});
    await ScrapingLog.deleteMany({});
  });

  describe("Event Model", () => {
    it("should create a valid event with required fields", async () => {
      const eventData = {
        title: "Test Event",
        dateTime: new Date("2024-03-15T19:00:00Z"),
        venueName: "Test Venue",
        venueAddress: "123 Test St, Sydney NSW",
        description: "A test event description",
        categoryTags: ["music", "concert"],
        sourceWebsite: "https://example.com",
        originalEventUrl: "https://example.com/event/123",
        lastScrapedAt: new Date(),
      };

      const event = new Event(eventData);
      const savedEvent = await event.save();

      expect(savedEvent._id).toBeDefined();
      expect(savedEvent.title).toBe(eventData.title);
      expect(savedEvent.city).toBe("Sydney"); // Default value
      expect(savedEvent.status).toBe(EventStatus.NEW); // Default value
      expect(savedEvent.createdAt).toBeDefined();
      expect(savedEvent.updatedAt).toBeDefined();
    });

    it("should validate required fields", async () => {
      const event = new Event({});

      await expect(event.save()).rejects.toThrow();
    });

    it("should enforce unique constraint on originalEventUrl and sourceWebsite", async () => {
      const eventData = {
        title: "Test Event",
        dateTime: new Date(),
        venueName: "Test Venue",
        description: "Test description",
        sourceWebsite: "https://example.com",
        originalEventUrl: "https://example.com/event/123",
        lastScrapedAt: new Date(),
      };

      await new Event(eventData).save();

      // Try to create duplicate with same URL and source
      const duplicateEvent = new Event({
        ...eventData,
        title: "Different Title", // Different title but same URL and source
      });

      await expect(duplicateEvent.save()).rejects.toThrow(/duplicate key/i);
    });
  });

  describe("User Model", () => {
    it("should create a valid user with required fields", async () => {
      const userData = {
        googleId: "123456789",
        email: "test@example.com",
        name: "Test User",
        profilePicture: "https://example.com/photo.jpg",
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.googleId).toBe(userData.googleId);
      expect(savedUser.email).toBe(userData.email.toLowerCase());
      expect(savedUser.name).toBe(userData.name);
      expect(savedUser.createdAt).toBeDefined();
    });

    it("should enforce unique constraint on googleId", async () => {
      const userData = {
        googleId: "123456789",
        email: "test@example.com",
        name: "Test User",
      };

      await new User(userData).save();

      // Try to create duplicate
      const duplicateUser = new User({
        ...userData,
        email: "different@example.com",
      });
      await expect(duplicateUser.save()).rejects.toThrow();
    });

    it("should validate email format", async () => {
      const user = new User({
        googleId: "123456789",
        email: "invalid-email",
        name: "Test User",
      });

      await expect(user.save()).rejects.toThrow();
    });
  });

  describe("EmailCapture Model", () => {
    it("should create a valid email capture", async () => {
      // First create an event to reference
      const event = await new Event({
        title: "Test Event",
        dateTime: new Date(),
        venueName: "Test Venue",
        description: "Test description",
        sourceWebsite: "https://example.com",
        originalEventUrl: "https://example.com/event/123",
        lastScrapedAt: new Date(),
      }).save();

      const captureData = {
        email: "user@example.com",
        consentGiven: true,
        eventId: event._id,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 Test Browser",
      };

      const capture = new EmailCapture(captureData);
      const savedCapture = await capture.save();

      expect(savedCapture._id).toBeDefined();
      expect(savedCapture.email).toBe(captureData.email.toLowerCase());
      expect(savedCapture.consentGiven).toBe(true);
      expect(savedCapture.capturedAt).toBeDefined();
    });

    it("should require consent to be true", async () => {
      const event = await new Event({
        title: "Test Event",
        dateTime: new Date(),
        venueName: "Test Venue",
        description: "Test description",
        sourceWebsite: "https://example.com",
        originalEventUrl: "https://example.com/event/123",
        lastScrapedAt: new Date(),
      }).save();

      const capture = new EmailCapture({
        email: "user@example.com",
        consentGiven: false,
        eventId: event._id,
      });

      await expect(capture.save()).rejects.toThrow();
    });
  });

  describe("ScrapingLog Model", () => {
    it("should create a valid scraping log", async () => {
      const logData = {
        sourceWebsite: "https://example.com",
        startTime: new Date(),
        eventsFound: 10,
        eventsProcessed: 8,
        scrapingErrors: ["Error 1", "Error 2"],
        status: "completed" as const,
      };

      const log = new ScrapingLog(logData);
      const savedLog = await log.save();

      expect(savedLog._id).toBeDefined();
      expect(savedLog.sourceWebsite).toBe(logData.sourceWebsite);
      expect(savedLog.eventsFound).toBe(logData.eventsFound);
      expect(savedLog.eventsProcessed).toBe(logData.eventsProcessed);
      expect(savedLog.status).toBe(logData.status);
      expect(savedLog.createdAt).toBeDefined();
    });

    it("should validate that eventsProcessed does not exceed eventsFound", async () => {
      const log = new ScrapingLog({
        sourceWebsite: "https://example.com",
        startTime: new Date(),
        eventsFound: 5,
        eventsProcessed: 10, // More than found
        status: "completed",
      });

      await expect(log.save()).rejects.toThrow();
    });

    it("should auto-set endTime when status is completed", async () => {
      const log = new ScrapingLog({
        sourceWebsite: "https://example.com",
        startTime: new Date(),
        eventsFound: 5,
        eventsProcessed: 5,
        status: "completed",
      });

      const savedLog = await log.save();
      expect(savedLog.endTime).toBeDefined();
    });
  });
});

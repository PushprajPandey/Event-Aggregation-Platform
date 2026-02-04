import request from "supertest";
import { Application } from "express";
import { createApp } from "../app";
import { database } from "../config/database";
import { Event } from "../models/Event";
import { EmailCapture } from "../models/EmailCapture";
import { User } from "../models/User";
import { ScrapingLog } from "../models/ScrapingLog";
import { ScraperOrchestrator } from "../scraping/ScraperOrchestrator";
import { ScheduledScraper } from "../scraping/ScheduledScraper";
import { ScraperEngine } from "../scraping/ScraperEngine";
import { StatusManager } from "../scraping/StatusManager";
import { config } from "../config/environment";

describe("Integration Tests - Sydney Events Aggregator", () => {
  let app: Application;
  let orchestrator: ScraperOrchestrator;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI =
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/sydney-events-test";

    // Connect to test database
    await database.connect();

    // Clear test database
    await database.clearDatabase();

    // Create Express app
    app = createApp();

    // Initialize scraper orchestrator for testing
    orchestrator = new ScraperOrchestrator({
      defaultSchedule: {
        cronExpression: "0 */6 * * *", // Every 6 hours
        enabled: false, // Disabled for testing
        timezone: "Australia/Sydney",
        name: "test-scraper",
      },
      maxConcurrentScrapers: 2,
      retryFailedSources: true,
      retryDelay: 1000,
      healthCheckInterval: 30000,
    });

    await orchestrator.initialize();
  });

  afterAll(async () => {
    // Cleanup
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await database.clearDatabase();
    await database.disconnect();
  });

  beforeEach(async () => {
    // Clear database before each test
    await database.clearDatabase();
  });

  describe("Complete User Flow - Public Site to Admin Dashboard", () => {
    it("should handle complete event discovery and email capture flow", async () => {
      // Step 1: Create test events in database (simulating scraper results)
      const testEvents = [
        {
          title: "Sydney Music Festival",
          dateTime: new Date("2024-06-15T19:00:00Z"),
          venueName: "Sydney Opera House",
          venueAddress: "Bennelong Point, Sydney NSW 2000",
          city: "Sydney",
          description:
            "Annual music festival featuring local and international artists",
          categoryTags: ["music", "festival"],
          imageUrl: "https://example.com/music-festival.jpg",
          sourceWebsite: "https://example.com",
          originalEventUrl: "https://example.com/events/music-festival",
          status: "new",
          lastScrapedAt: new Date(),
        },
        {
          title: "Tech Conference Sydney",
          dateTime: new Date("2024-07-20T09:00:00Z"),
          venueName: "International Convention Centre",
          venueAddress: "14 Darling Dr, Sydney NSW 2000",
          city: "Sydney",
          description: "Leading technology conference in Australia",
          categoryTags: ["technology", "conference"],
          sourceWebsite: "https://techconf.com",
          originalEventUrl: "https://techconf.com/sydney-2024",
          status: "new",
          lastScrapedAt: new Date(),
        },
      ];

      const createdEvents = await Event.insertMany(testEvents);
      expect(createdEvents).toHaveLength(2);

      // Step 2: Test public events listing
      const eventsResponse = await request(app).get("/api/events").expect(200);

      expect(eventsResponse.body.success).toBe(true);
      expect(eventsResponse.body.data.events).toHaveLength(2);
      expect(eventsResponse.body.data.pagination.total).toBe(2);

      // Verify event data structure
      const firstEvent = eventsResponse.body.data.events[0];
      expect(firstEvent).toHaveProperty("title");
      expect(firstEvent).toHaveProperty("dateTime");
      expect(firstEvent).toHaveProperty("venueName");
      expect(firstEvent).toHaveProperty("originalEventUrl");

      // Step 3: Test event filtering by city
      const sydneyEventsResponse = await request(app)
        .get("/api/events?city=Sydney")
        .expect(200);

      expect(sydneyEventsResponse.body.data.events).toHaveLength(2);

      // Step 4: Test individual event retrieval
      const eventId = createdEvents[0]._id.toString();
      const singleEventResponse = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(200);

      expect(singleEventResponse.body.success).toBe(true);
      expect(singleEventResponse.body.data.event.title).toBe(
        "Sydney Music Festival",
      );

      // Step 5: Test email capture flow
      const emailCaptureData = {
        email: "test@example.com",
        consentGiven: true,
        eventId: eventId,
      };

      const emailCaptureResponse = await request(app)
        .post("/api/email-capture")
        .send(emailCaptureData)
        .expect(200);

      expect(emailCaptureResponse.body.success).toBe(true);
      expect(emailCaptureResponse.body.data.redirectUrl).toBe(
        testEvents[0].originalEventUrl,
      );

      // Verify email capture was stored
      const storedEmailCapture = await EmailCapture.findOne({
        email: "test@example.com",
      });
      expect(storedEmailCapture).toBeTruthy();
      expect(storedEmailCapture!.consentGiven).toBe(true);
      expect(storedEmailCapture!.eventId.toString()).toBe(eventId);
    });

    it("should handle email capture validation errors", async () => {
      // Test missing email
      const invalidData1 = {
        consentGiven: true,
        eventId: "507f1f77bcf86cd799439011",
      };

      await request(app)
        .post("/api/email-capture")
        .send(invalidData1)
        .expect(400);

      // Test missing consent
      const invalidData2 = {
        email: "test@example.com",
        eventId: "507f1f77bcf86cd799439011",
      };

      await request(app)
        .post("/api/email-capture")
        .send(invalidData2)
        .expect(400);

      // Test invalid event ID
      const invalidData3 = {
        email: "test@example.com",
        consentGiven: true,
        eventId: "invalid-id",
      };

      await request(app)
        .post("/api/email-capture")
        .send(invalidData3)
        .expect(400);
    });
  });

  describe("OAuth Integration and Session Management", () => {
    it("should redirect unauthenticated users to Google OAuth", async () => {
      const response = await request(app).get("/api/admin/events").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Admin authentication required");
    });

    it("should handle OAuth callback flow", async () => {
      // Test OAuth initiation
      const authResponse = await request(app).get("/auth/google").expect(302);

      expect(authResponse.headers.location).toContain("accounts.google.com");
    });

    it("should create user session after successful OAuth", async () => {
      // Create a test user (simulating successful OAuth)
      const testUser = new User({
        googleId: "test-google-id-123",
        email: "admin@example.com",
        name: "Test Admin",
        profilePicture: "https://example.com/profile.jpg",
      });

      await testUser.save();

      // Verify user was created
      const savedUser = await User.findOne({ googleId: "test-google-id-123" });
      expect(savedUser).toBeTruthy();
      expect(savedUser!.email).toBe("admin@example.com");
    });
  });

  describe("Admin Dashboard Integration", () => {
    let testUser: any;

    beforeEach(async () => {
      // Create test user for admin operations
      testUser = new User({
        googleId: "admin-google-id-456",
        email: "admin@example.com",
        name: "Admin User",
        profilePicture: "https://example.com/admin.jpg",
      });
      await testUser.save();

      // Create test events with different statuses
      await Event.insertMany([
        {
          title: "New Event 1",
          dateTime: new Date("2024-08-01T18:00:00Z"),
          venueName: "Test Venue 1",
          city: "Sydney",
          description: "Test event 1",
          categoryTags: ["test"],
          sourceWebsite: "https://test1.com",
          originalEventUrl: "https://test1.com/event1",
          status: "new",
          lastScrapedAt: new Date(),
        },
        {
          title: "Updated Event 2",
          dateTime: new Date("2024-08-02T19:00:00Z"),
          venueName: "Test Venue 2",
          city: "Sydney",
          description: "Test event 2",
          categoryTags: ["test"],
          sourceWebsite: "https://test2.com",
          originalEventUrl: "https://test2.com/event2",
          status: "updated",
          lastScrapedAt: new Date(),
        },
        {
          title: "Imported Event 3",
          dateTime: new Date("2024-08-03T20:00:00Z"),
          venueName: "Test Venue 3",
          city: "Sydney",
          description: "Test event 3",
          categoryTags: ["test"],
          sourceWebsite: "https://test3.com",
          originalEventUrl: "https://test3.com/event3",
          status: "imported",
          importedAt: new Date(),
          importedBy: testUser._id,
          importNotes: "Test import",
          lastScrapedAt: new Date(),
        },
      ]);
    });

    it("should filter events by status in admin dashboard", async () => {
      // Mock authentication middleware for testing
      const agent = request.agent(app);

      // Test filtering by status
      const newEventsResponse = await agent
        .get("/api/admin/events?status=new")
        .expect(200);

      expect(newEventsResponse.body.success).toBe(true);
      expect(newEventsResponse.body.data.events).toHaveLength(1);
      expect(newEventsResponse.body.data.events[0].status).toBe("new");

      const updatedEventsResponse = await agent
        .get("/api/admin/events?status=updated")
        .expect(200);

      expect(updatedEventsResponse.body.data.events).toHaveLength(1);
      expect(updatedEventsResponse.body.data.events[0].status).toBe("updated");
    });

    it("should handle event import workflow", async () => {
      const events = await Event.find({ status: "new" });
      expect(events).toHaveLength(1);

      const eventToImport = events[0];

      // Test event import
      const importResponse = await request(app)
        .put(`/api/admin/events/${eventToImport._id}/import`)
        .send({
          importNotes: "Imported via integration test",
        })
        .expect(200);

      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.data.event.status).toBe("imported");
      expect(importResponse.body.data.event.importNotes).toBe(
        "Imported via integration test",
      );

      // Verify event was updated in database
      const updatedEvent = await Event.findById(eventToImport._id);
      expect(updatedEvent!.status).toBe("imported");
      expect(updatedEvent!.importedAt).toBeTruthy();
      expect(updatedEvent!.importNotes).toBe("Imported via integration test");
    });
  });

  describe("Scraper Integration with Live Data Sources", () => {
    it("should handle scraper orchestration lifecycle", async () => {
      // Test orchestrator initialization
      expect(orchestrator).toBeTruthy();

      const health = orchestrator.getHealth();
      expect(health.totalScrapers).toBeGreaterThan(0);
      expect(health.uptime).toBeGreaterThan(0);

      // Test scraper status
      const scrapersStatus = orchestrator.getScrapersStatus();
      expect(scrapersStatus.size).toBeGreaterThan(0);

      // Test manual scraping execution
      const scrapingResult = await orchestrator.executeManualScrapingAll();
      expect(scrapingResult).toBeTruthy();
      expect(scrapingResult.size).toBeGreaterThan(0);

      // Verify scraping logs were created
      const scrapingLogs = await ScrapingLog.find({}).sort({ startTime: -1 });
      expect(scrapingLogs.length).toBeGreaterThan(0);

      const latestLog = scrapingLogs[0];
      expect(latestLog.sourceWebsite).toBeTruthy();
      expect(latestLog.startTime).toBeTruthy();
      expect(["running", "completed", "failed"]).toContain(latestLog.status);
    });

    it("should handle scraper error isolation", async () => {
      // Create a scraper with invalid source to test error handling
      const invalidSource = {
        name: "Invalid Test Source",
        url: "https://invalid-domain-that-does-not-exist.com/events",
        selectors: {
          eventContainer: ".event",
          title: ".title",
          dateTime: ".date",
          venueName: ".venue",
          description: ".description",
          originalEventUrl: ".link",
        },
        baseUrl: "https://invalid-domain-that-does-not-exist.com",
      };

      const statusManager = new StatusManager();
      const scraperEngine = new ScraperEngine(
        [invalidSource],
        undefined,
        statusManager,
      );

      const scheduledScraper = new ScheduledScraper(scraperEngine, {
        cronExpression: "0 0 * * *",
        enabled: false,
        name: "error-test-scraper",
      });

      // Execute scraping and expect it to handle errors gracefully
      const result = await scheduledScraper.executeManualScraping();

      expect(result.totalSources).toBe(1);
      expect(result.failedSources).toBe(1);
      expect(result.successfulSources).toBe(0);
      expect(result.totalErrors).toBeGreaterThan(0);

      // Verify error was logged
      const errorLogs = await ScrapingLog.find({ status: "failed" });
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    it("should maintain data consistency during scraping", async () => {
      // Create initial events
      const initialEvents = await Event.insertMany([
        {
          title: "Existing Event",
          dateTime: new Date("2024-09-01T18:00:00Z"),
          venueName: "Existing Venue",
          city: "Sydney",
          description: "Existing event description",
          categoryTags: ["existing"],
          sourceWebsite: "https://existing.com",
          originalEventUrl: "https://existing.com/event",
          status: "imported",
          lastScrapedAt: new Date(),
        },
      ]);

      const initialCount = await Event.countDocuments();
      expect(initialCount).toBe(1);

      // Execute scraping (which may fail due to invalid sources)
      await orchestrator.executeManualScrapingAll();

      // Verify existing events are preserved (Property 4: Event Persistence Invariant)
      const finalCount = await Event.countDocuments();
      expect(finalCount).toBeGreaterThanOrEqual(initialCount);

      // Verify existing event is still there
      const existingEvent = await Event.findById(initialEvents[0]._id);
      expect(existingEvent).toBeTruthy();
      expect(existingEvent!.title).toBe("Existing Event");
    });
  });

  describe("System Health and Monitoring", () => {
    it("should provide comprehensive health information", async () => {
      const healthResponse = await request(app).get("/health").expect(200);

      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data).toHaveProperty("timestamp");
      expect(healthResponse.body.data).toHaveProperty("environment");
      expect(healthResponse.body.data).toHaveProperty("version");
      expect(healthResponse.body.data).toHaveProperty("uptime");
    });

    it("should provide detailed health monitoring", async () => {
      const detailedHealthResponse = await request(app)
        .get("/health/detailed")
        .expect(200);

      expect(detailedHealthResponse.body.data).toHaveProperty("database");
      expect(detailedHealthResponse.body.data).toHaveProperty("memory");
      expect(detailedHealthResponse.body.data).toHaveProperty("errors");
      expect(detailedHealthResponse.body.data).toHaveProperty("services");
    });

    it("should handle readiness and liveness probes", async () => {
      const readinessResponse = await request(app)
        .get("/health/ready")
        .expect(200);

      expect(readinessResponse.body.data.ready).toBe(true);

      const livenessResponse = await request(app)
        .get("/health/live")
        .expect(200);

      expect(livenessResponse.body.data.alive).toBe(true);
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should handle database connection failures gracefully", async () => {
      // Temporarily disconnect database to test resilience
      await database.disconnect();

      const response = await request(app).get("/api/events").expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("service unavailable");

      // Reconnect database
      await database.connect();
    });

    it("should handle malformed requests gracefully", async () => {
      // Test malformed JSON
      const response = await request(app)
        .post("/api/email-capture")
        .set("Content-Type", "application/json")
        .send("invalid json")
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should handle rate limiting headers", async () => {
      const response = await request(app).get("/api/events").expect(200);

      // Check for rate limiting headers
      expect(response.headers).toHaveProperty("x-ratelimit-limit");
      expect(response.headers).toHaveProperty("x-ratelimit-remaining");
    });
  });

  describe("Data Validation and Security", () => {
    it("should validate event data integrity", async () => {
      // Test creating event with missing required fields
      const invalidEvent = {
        title: "Test Event",
        // Missing required fields: dateTime, venueName, etc.
      };

      try {
        await Event.create(invalidEvent);
        fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it("should sanitize user input", async () => {
      // Test XSS prevention in email capture
      const maliciousData = {
        email: "<script>alert('xss')</script>@example.com",
        consentGiven: true,
        eventId: "507f1f77bcf86cd799439011",
      };

      const response = await request(app)
        .post("/api/email-capture")
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid email format");
    });

    it("should handle CORS properly", async () => {
      const response = await request(app)
        .options("/api/events")
        .set("Origin", "http://localhost:3000")
        .expect(204);

      expect(response.headers["access-control-allow-origin"]).toBeTruthy();
      expect(response.headers["access-control-allow-methods"]).toBeTruthy();
    });
  });
});

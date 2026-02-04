import { createApp } from "../app";
import { database } from "../config/database";
import { ScrapingService } from "../scraping/ScrapingService";
import { Event } from "../models/Event";
import { EmailCapture } from "../models/EmailCapture";
import { User } from "../models/User";
import { ScrapingLog } from "../models/ScrapingLog";
import request from "supertest";

describe("System Integration - Component Wiring Tests", () => {
  let app: any;
  let scrapingService: ScrapingService;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI =
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/sydney-events-system-test";

    // Connect to database
    await database.connect();
    await database.clearDatabase();

    // Create app
    app = createApp();

    // Initialize scraping service
    scrapingService = new ScrapingService({
      orchestrator: {
        defaultSchedule: {
          cronExpression: "0 0 * * *",
          enabled: false,
          timezone: "Australia/Sydney",
          name: "system-test-scraper",
        },
        maxConcurrentScrapers: 1,
        retryFailedSources: true,
        retryDelay: 500,
        healthCheckInterval: 10000,
      },
      logger: {
        logLevel: "info" as any,
        logToConsole: false,
        logToFile: false,
        logDirectory: "./test-logs",
      },
      defaultSources: [
        {
          name: "Integration Test Source",
          url: "https://example.com/test-events",
          selectors: {
            eventContainer: ".event",
            title: ".title",
            dateTime: ".date",
            venueName: ".venue",
            description: ".description",
            originalEventUrl: ".link",
          },
          baseUrl: "https://example.com",
        },
      ],
    });

    await scrapingService.initialize();
  });

  afterAll(async () => {
    if (scrapingService) {
      await scrapingService.shutdown();
    }
    await database.clearDatabase();
    await database.disconnect();
  });

  beforeEach(async () => {
    await database.clearDatabase();
  });

  describe("Database and Model Integration", () => {
    it("should properly wire database models with validation", async () => {
      // Test Event model integration
      const eventData = {
        title: "Integration Test Event",
        dateTime: new Date("2024-06-01T19:00:00Z"),
        venueName: "Test Venue",
        city: "Sydney",
        description: "Test event for integration",
        categoryTags: ["test", "integration"],
        sourceWebsite: "https://test.com",
        originalEventUrl: "https://test.com/event",
        status: "new",
        lastScrapedAt: new Date(),
      };

      const event = new Event(eventData);
      const savedEvent = await event.save();

      expect(savedEvent._id).toBeTruthy();
      expect(savedEvent.title).toBe(eventData.title);
      expect(savedEvent.status).toBe("new");

      // Test User model integration
      const userData = {
        googleId: "test-google-123",
        email: "test@example.com",
        name: "Test User",
        profilePicture: "https://example.com/pic.jpg",
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeTruthy();
      expect(savedUser.googleId).toBe(userData.googleId);

      // Test EmailCapture model integration with foreign key
      const emailCaptureData = {
        email: "capture@example.com",
        consentGiven: true,
        eventId: savedEvent._id,
        capturedAt: new Date(),
      };

      const emailCapture = new EmailCapture(emailCaptureData);
      const savedCapture = await emailCapture.save();

      expect(savedCapture._id).toBeTruthy();
      expect(savedCapture.eventId.toString()).toBe(savedEvent._id.toString());

      // Test ScrapingLog model integration
      const scrapingLog = await ScrapingLog.createLog("test.com");
      await scrapingLog.markCompleted(1, 1);

      expect(scrapingLog.sourceWebsite).toBe("https://test.com");
      expect(scrapingLog.status).toBe("completed");
    });

    it("should handle model validation errors properly", async () => {
      // Test Event validation
      const invalidEvent = new Event({
        title: "Test Event",
        // Missing required fields
      });

      try {
        await invalidEvent.save();
        fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
        expect(error.errors).toBeTruthy();
      }

      // Test User validation
      const invalidUser = new User({
        email: "invalid-email",
        // Missing required fields
      });

      try {
        await invalidUser.save();
        fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
      }
    });
  });

  describe("API Routes and Middleware Integration", () => {
    it("should properly wire all API routes with middleware", async () => {
      // Create test data
      const testEvent = await Event.create({
        title: "API Test Event",
        dateTime: new Date("2024-07-01T20:00:00Z"),
        venueName: "API Test Venue",
        city: "Sydney",
        description: "Event for API testing",
        categoryTags: ["api", "test"],
        sourceWebsite: "https://apitest.com",
        originalEventUrl: "https://apitest.com/event",
        status: "new",
        lastScrapedAt: new Date(),
      });

      // Test public events API
      const eventsResponse = await request(app).get("/api/events").expect(200);

      expect(eventsResponse.body.success).toBe(true);
      expect(eventsResponse.body.data.events).toHaveLength(1);

      // Test individual event API
      const eventResponse = await request(app)
        .get(`/api/events/${testEvent._id}`)
        .expect(200);

      expect(eventResponse.body.success).toBe(true);
      expect(eventResponse.body.data.event.title).toBe("API Test Event");

      // Test email capture API
      const emailCaptureResponse = await request(app)
        .post("/api/email-capture")
        .send({
          email: "api@example.com",
          consentGiven: true,
          eventId: testEvent._id.toString(),
        })
        .expect(200);

      expect(emailCaptureResponse.body.success).toBe(true);
      expect(emailCaptureResponse.body.data.redirectUrl).toBe(
        testEvent.originalEventUrl,
      );

      // Test admin routes (should require authentication)
      const adminResponse = await request(app)
        .get("/api/admin/events")
        .expect(401);

      expect(adminResponse.body.success).toBe(false);
    });

    it("should handle middleware error propagation", async () => {
      // Test invalid JSON handling
      const invalidJsonResponse = await request(app)
        .post("/api/email-capture")
        .set("Content-Type", "application/json")
        .send("invalid json")
        .expect(400);

      expect(invalidJsonResponse.body.success).toBe(false);

      // Test 404 handling
      const notFoundResponse = await request(app)
        .get("/api/nonexistent")
        .expect(404);

      expect(notFoundResponse.body.success).toBe(false);
      expect(notFoundResponse.body.error).toContain("not found");
    });
  });

  describe("Scraping Service Integration", () => {
    it("should integrate scraping service with database and status management", async () => {
      // Test scraping service initialization
      expect(scrapingService).toBeTruthy();

      const health = await scrapingService.getHealth();
      expect(health.isHealthy).toBe(true);

      // Test manual scraping execution
      const scrapingResult = await scrapingService.executeManualScraping();
      expect(scrapingResult).toBeTruthy();

      // Verify scraping logs were created
      const scrapingLogs = await ScrapingLog.find({}).sort({ startTime: -1 });
      expect(scrapingLogs.length).toBeGreaterThan(0);

      const latestLog = scrapingLogs[0];
      expect(latestLog.sourceWebsite).toBeTruthy();
      expect(["running", "completed", "failed"]).toContain(latestLog.status);
    });

    it("should handle scraping service lifecycle", async () => {
      // Test service start
      await scrapingService.start();

      const runningHealth = await scrapingService.getHealth();
      expect(runningHealth.isHealthy).toBe(true);

      // Test service stop
      await scrapingService.stop();

      const stoppedHealth = await scrapingService.getHealth();
      // Service should still be healthy but not actively scraping
      expect(stoppedHealth).toBeTruthy();
    });
  });

  describe("Authentication and Session Integration", () => {
    it("should integrate authentication with user management", async () => {
      // Create test user (simulating OAuth success)
      const testUser = await User.create({
        googleId: "auth-integration-123",
        email: "auth@example.com",
        name: "Auth Test User",
        profilePicture: "https://example.com/auth.jpg",
      });

      expect(testUser._id).toBeTruthy();
      expect(testUser.googleId).toBe("auth-integration-123");

      // Test user lookup by Google ID
      const foundUser = await User.findOne({
        googleId: "auth-integration-123",
      });
      expect(foundUser).toBeTruthy();
      expect(foundUser!.email).toBe("auth@example.com");

      // Test user update on subsequent logins
      foundUser!.lastLoginAt = new Date();
      await foundUser!.save();

      const updatedUser = await User.findById(foundUser!._id);
      expect(updatedUser!.lastLoginAt).toBeTruthy();
    });

    it("should handle authentication flow endpoints", async () => {
      // Test OAuth initiation
      const authInitResponse = await request(app)
        .get("/auth/google")
        .expect(302);

      expect(authInitResponse.headers.location).toContain(
        "accounts.google.com",
      );

      // Test user info endpoint (unauthenticated)
      const userInfoResponse = await request(app).get("/auth/user").expect(200);

      // Should handle unauthenticated request gracefully
      expect(userInfoResponse.body).toBeTruthy();

      // Test logout endpoint
      const logoutResponse = await request(app)
        .post("/auth/logout")
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);
    });
  });

  describe("Error Handling and Resilience Integration", () => {
    it("should integrate error handling across all components", async () => {
      // Test database error handling
      await database.disconnect();

      const dbErrorResponse = await request(app).get("/api/events").expect(503);

      expect(dbErrorResponse.body.success).toBe(false);

      // Reconnect for other tests
      await database.connect();

      // Test scraping error handling
      const scrapingResult = await scrapingService.executeManualScraping();
      // Should handle errors gracefully even if sources fail
      expect(scrapingResult).toBeTruthy();

      // Test API error handling
      const invalidEventResponse = await request(app)
        .get("/api/events/invalid-id")
        .expect(400);

      expect(invalidEventResponse.body.success).toBe(false);
      expect(invalidEventResponse.body.error).toContain("Invalid event ID");
    });

    it("should maintain system health monitoring integration", async () => {
      // Test basic health endpoint
      const healthResponse = await request(app).get("/health").expect(200);

      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data.environment).toBe("test");

      // Test detailed health endpoint
      const detailedHealthResponse = await request(app)
        .get("/health/detailed")
        .expect(200);

      expect(detailedHealthResponse.body.data.database).toBeTruthy();
      expect(detailedHealthResponse.body.data.memory).toBeTruthy();

      // Test readiness probe
      const readinessResponse = await request(app)
        .get("/health/ready")
        .expect(200);

      expect(readinessResponse.body.data.ready).toBe(true);

      // Test liveness probe
      const livenessResponse = await request(app)
        .get("/health/live")
        .expect(200);

      expect(livenessResponse.body.data.alive).toBe(true);
    });
  });

  describe("Cross-Component Data Flow", () => {
    it("should handle complete data flow from scraping to display", async () => {
      // Step 1: Simulate scraping creating events
      const scrapedEvent = await Event.create({
        title: "Data Flow Test Event",
        dateTime: new Date("2024-08-01T18:00:00Z"),
        venueName: "Flow Test Venue",
        city: "Sydney",
        description: "Testing complete data flow",
        categoryTags: ["dataflow", "test"],
        sourceWebsite: "https://flowtest.com",
        originalEventUrl: "https://flowtest.com/event",
        status: "new",
        lastScrapedAt: new Date(),
      });

      // Step 2: Create scraping log
      const scrapingLog = await ScrapingLog.createLog("https://flowtest.com");
      await scrapingLog.markCompleted(1, 1);

      // Step 3: Verify event appears in public API
      const publicResponse = await request(app).get("/api/events").expect(200);

      expect(publicResponse.body.data.events).toHaveLength(1);
      expect(publicResponse.body.data.events[0].title).toBe(
        "Data Flow Test Event",
      );

      // Step 4: Simulate user email capture
      const emailCaptureResponse = await request(app)
        .post("/api/email-capture")
        .send({
          email: "dataflow@example.com",
          consentGiven: true,
          eventId: scrapedEvent._id.toString(),
        })
        .expect(200);

      expect(emailCaptureResponse.body.success).toBe(true);

      // Step 5: Verify email capture is linked to event
      const emailCapture = await EmailCapture.findOne({
        email: "dataflow@example.com",
      });
      expect(emailCapture).toBeTruthy();
      expect(emailCapture!.eventId.toString()).toBe(
        scrapedEvent._id.toString(),
      );

      // Step 6: Verify admin can see event
      const adminResponse = await request(app)
        .get("/api/admin/events")
        .expect(200);

      expect(adminResponse.body.data.events).toHaveLength(1);
      expect(adminResponse.body.data.events[0].status).toBe("new");

      // Step 7: Import event
      const importResponse = await request(app)
        .put(`/api/admin/events/${scrapedEvent._id}/import`)
        .send({ importNotes: "Data flow test import" })
        .expect(200);

      expect(importResponse.body.data.event.status).toBe("imported");

      // Step 8: Verify complete data integrity
      const finalEvent = await Event.findById(scrapedEvent._id);
      expect(finalEvent!.status).toBe("imported");
      expect(finalEvent!.importNotes).toBe("Data flow test import");

      const relatedCaptures = await EmailCapture.find({
        eventId: scrapedEvent._id,
      });
      expect(relatedCaptures).toHaveLength(1);

      const relatedLogs = await ScrapingLog.find({
        sourceWebsite: "https://flowtest.com",
      });
      expect(relatedLogs).toHaveLength(1);
    });
  });

  describe("Configuration and Environment Integration", () => {
    it("should properly integrate configuration across components", async () => {
      // Test environment configuration
      expect(process.env.NODE_ENV).toBe("test");

      // Test database configuration
      const dbStatus = database.getConnectionStatus();
      expect(dbStatus).toBe(true);

      // Test scraping service health
      const scrapingHealth = scrapingService.getHealth();
      expect(scrapingHealth).toBeTruthy();
      expect(scrapingHealth.totalScrapers).toBeGreaterThanOrEqual(0);

      // Test app configuration through health endpoint
      const healthResponse = await request(app).get("/health").expect(200);

      expect(healthResponse.body.data.environment).toBe("test");
      expect(healthResponse.body.data.version).toBe("1.0.0");
    });
  });
});

import request from "supertest";
import { Application } from "express";
import { createApp } from "../app";
import { database } from "../config/database";
import { Event } from "../models/Event";
import { EmailCapture } from "../models/EmailCapture";
import { User } from "../models/User";
import { ScrapingLog } from "../models/ScrapingLog";
import { ScraperOrchestrator } from "../scraping/ScraperOrchestrator";
import { ScrapingService } from "../scraping/ScrapingService";

describe("End-to-End Tests - Complete System Workflows", () => {
  let app: Application;
  let orchestrator: ScraperOrchestrator;
  let scrapingService: ScrapingService;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI =
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/sydney-events-e2e-test";

    // Connect to test database
    await database.connect();

    // Clear test database
    await database.clearDatabase();

    // Create Express app
    app = createApp();

    // Initialize scraping service
    scrapingService = new ScrapingService({
      orchestrator: {
        defaultSchedule: {
          cronExpression: "0 */6 * * *",
          enabled: false,
          timezone: "Australia/Sydney",
          name: "test-scraper",
        },
        maxConcurrentScrapers: 1,
        retryFailedSources: true,
        retryDelay: 1000,
        healthCheckInterval: 30000,
      },
      logger: {
        logLevel: "info" as any,
        logToConsole: false,
        logToFile: false,
        logDirectory: "./test-logs",
      },
      defaultSources: [
        {
          name: "Test Event Source",
          url: "https://example.com/events",
          selectors: {
            eventContainer: ".event-item",
            title: ".event-title",
            dateTime: ".event-date",
            venueName: ".venue-name",
            description: ".event-description",
            originalEventUrl: ".event-link",
          },
          baseUrl: "https://example.com",
        },
      ],
    });

    await scrapingService.initialize();
  });

  afterAll(async () => {
    // Cleanup
    if (scrapingService) {
      await scrapingService.shutdown();
    }
    await database.clearDatabase();
    await database.disconnect();
  });

  beforeEach(async () => {
    // Clear database before each test
    await database.clearDatabase();
  });

  describe("Complete Event Lifecycle - Scraping to Display to Import", () => {
    it("should handle complete event lifecycle from scraping to admin import", async () => {
      // Step 1: Simulate scraping process by creating events
      const scrapedEvents = [
        {
          title: "Sydney New Year's Eve Fireworks",
          dateTime: new Date("2024-12-31T21:00:00Z"),
          venueName: "Sydney Harbour",
          venueAddress: "Sydney Harbour, Sydney NSW",
          city: "Sydney",
          description:
            "World-famous New Year's Eve fireworks display over Sydney Harbour",
          categoryTags: ["celebration", "fireworks", "new-year"],
          imageUrl: "https://example.com/nye-fireworks.jpg",
          sourceWebsite: "https://sydney.com",
          originalEventUrl: "https://sydney.com/events/nye-fireworks",
          status: "new",
          lastScrapedAt: new Date(),
        },
        {
          title: "Vivid Sydney Light Festival",
          dateTime: new Date("2024-05-24T18:00:00Z"),
          venueName: "Circular Quay",
          venueAddress: "Circular Quay, Sydney NSW 2000",
          city: "Sydney",
          description:
            "Annual festival of light, music and ideas transforming Sydney",
          categoryTags: ["festival", "lights", "art"],
          imageUrl: "https://example.com/vivid-sydney.jpg",
          sourceWebsite: "https://vividsydney.com",
          originalEventUrl: "https://vividsydney.com/events/light-festival",
          status: "new",
          lastScrapedAt: new Date(),
        },
      ];

      const createdEvents = await Event.insertMany(scrapedEvents);
      expect(createdEvents).toHaveLength(2);

      // Create scraping log to simulate scraper activity
      const scrapingLog = await ScrapingLog.createLog("sydney.com");
      await scrapingLog.markCompleted(2, 2);

      // Step 2: Test public website displays scraped events
      const publicEventsResponse = await request(app)
        .get("/api/events")
        .expect(200);

      expect(publicEventsResponse.body.success).toBe(true);
      expect(publicEventsResponse.body.data.events).toHaveLength(2);

      // Verify events have all required public display fields
      const displayedEvent = publicEventsResponse.body.data.events[0];
      expect(displayedEvent).toHaveProperty("title");
      expect(displayedEvent).toHaveProperty("dateTime");
      expect(displayedEvent).toHaveProperty("venueName");
      expect(displayedEvent).toHaveProperty("description");
      expect(displayedEvent).toHaveProperty("originalEventUrl");
      expect(displayedEvent).not.toHaveProperty("status"); // Status should not be exposed to public

      // Step 3: Test event filtering and search
      const filteredResponse = await request(app)
        .get("/api/events?search=fireworks")
        .expect(200);

      expect(filteredResponse.body.data.events).toHaveLength(1);
      expect(filteredResponse.body.data.events[0].title).toContain("Fireworks");

      // Step 4: Test email capture workflow
      const eventId = createdEvents[0]._id.toString();
      const emailCaptureData = {
        email: "user@example.com",
        consentGiven: true,
        eventId: eventId,
      };

      const emailResponse = await request(app)
        .post("/api/email-capture")
        .send(emailCaptureData)
        .expect(200);

      expect(emailResponse.body.success).toBe(true);
      expect(emailResponse.body.data.redirectUrl).toBe(
        scrapedEvents[0].originalEventUrl,
      );

      // Verify email capture was stored with proper data
      const storedCapture = await EmailCapture.findOne({
        email: "user@example.com",
      });
      expect(storedCapture).toBeTruthy();
      expect(storedCapture!.consentGiven).toBe(true);
      expect(storedCapture!.eventId.toString()).toBe(eventId);
      expect(storedCapture!.capturedAt).toBeTruthy();

      // Step 5: Create admin user for dashboard testing
      const adminUser = new User({
        googleId: "admin-test-123",
        email: "admin@sydney-events.com",
        name: "Test Admin",
        profilePicture: "https://example.com/admin.jpg",
      });
      await adminUser.save();

      // Step 6: Test admin dashboard event listing
      const adminEventsResponse = await request(app)
        .get("/api/admin/events")
        .expect(200);

      expect(adminEventsResponse.body.success).toBe(true);
      expect(adminEventsResponse.body.data.events).toHaveLength(2);

      // Verify admin view includes status information
      const adminEvent = adminEventsResponse.body.data.events[0];
      expect(adminEvent).toHaveProperty("status");
      expect(adminEvent.status).toBe("new");

      // Step 7: Test admin event filtering by status
      const newEventsResponse = await request(app)
        .get("/api/admin/events?status=new")
        .expect(200);

      expect(newEventsResponse.body.data.events).toHaveLength(2);
      newEventsResponse.body.data.events.forEach((event: any) => {
        expect(event.status).toBe("new");
      });

      // Step 8: Test event import workflow
      const eventToImport = createdEvents[1]; // Vivid Sydney event
      const importData = {
        importNotes: "Approved for platform - major Sydney event",
      };

      const importResponse = await request(app)
        .put(`/api/admin/events/${eventToImport._id}/import`)
        .send(importData)
        .expect(200);

      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.data.event.status).toBe("imported");
      expect(importResponse.body.data.event.importNotes).toBe(
        importData.importNotes,
      );
      expect(importResponse.body.data.event.importedAt).toBeTruthy();

      // Step 9: Verify imported event appears in filtered results
      const importedEventsResponse = await request(app)
        .get("/api/admin/events?status=imported")
        .expect(200);

      expect(importedEventsResponse.body.data.events).toHaveLength(1);
      expect(importedEventsResponse.body.data.events[0].title).toBe(
        "Vivid Sydney Light Festival",
      );

      // Step 10: Verify public site still shows all events (including imported)
      const finalPublicResponse = await request(app)
        .get("/api/events")
        .expect(200);

      expect(finalPublicResponse.body.data.events).toHaveLength(2);

      // Step 11: Test dashboard statistics
      const statsResponse = await request(app)
        .get("/api/admin/dashboard-stats")
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data.totalEvents).toBe(2);
      expect(statsResponse.body.data.newEvents).toBe(1);
      expect(statsResponse.body.data.importedEvents).toBe(1);
    });
  });

  describe("Scraper Integration with Status Management", () => {
    it("should handle event status transitions during scraping updates", async () => {
      // Step 1: Create initial event (simulating first scrape)
      const initialEvent = await Event.create({
        title: "Sydney Food Festival",
        dateTime: new Date("2024-10-15T12:00:00Z"),
        venueName: "Hyde Park",
        city: "Sydney",
        description: "Annual food festival in Hyde Park",
        categoryTags: ["food", "festival"],
        sourceWebsite: "https://foodfest.com",
        originalEventUrl: "https://foodfest.com/sydney-2024",
        status: "new",
        lastScrapedAt: new Date(),
      });

      expect(initialEvent.status).toBe("new");

      // Step 2: Simulate event update (changed description)
      const updatedEventData = {
        title: "Sydney Food Festival",
        dateTime: new Date("2024-10-15T12:00:00Z"),
        venueName: "Hyde Park",
        city: "Sydney",
        description:
          "Annual food festival in Hyde Park - Now with 50+ vendors!", // Updated description
        categoryTags: ["food", "festival"],
        sourceWebsite: "https://foodfest.com",
        originalEventUrl: "https://foodfest.com/sydney-2024",
        lastScrapedAt: new Date(),
      };

      // Update the event to simulate scraper finding changes
      await Event.findByIdAndUpdate(initialEvent._id, {
        ...updatedEventData,
        status: "updated",
      });

      // Step 3: Verify status transition
      const updatedEvent = await Event.findById(initialEvent._id);
      expect(updatedEvent!.status).toBe("updated");
      expect(updatedEvent!.description).toContain("50+ vendors");

      // Step 4: Test admin can see updated events
      const updatedEventsResponse = await request(app)
        .get("/api/admin/events?status=updated")
        .expect(200);

      expect(updatedEventsResponse.body.data.events).toHaveLength(1);
      expect(updatedEventsResponse.body.data.events[0].title).toBe(
        "Sydney Food Festival",
      );

      // Step 5: Import the updated event
      const importResponse = await request(app)
        .put(`/api/admin/events/${initialEvent._id}/import`)
        .send({ importNotes: "Updated event approved" })
        .expect(200);

      expect(importResponse.body.data.event.status).toBe("imported");

      // Step 6: Simulate event becoming inactive (no longer found on source)
      await Event.findByIdAndUpdate(initialEvent._id, {
        status: "inactive",
      });

      const inactiveEventsResponse = await request(app)
        .get("/api/admin/events?status=inactive")
        .expect(200);

      expect(inactiveEventsResponse.body.data.events).toHaveLength(1);
    });
  });

  describe("System Resilience and Error Recovery", () => {
    it("should maintain public site availability during scraper failures", async () => {
      // Step 1: Create existing events
      await Event.insertMany([
        {
          title: "Existing Event 1",
          dateTime: new Date("2024-11-01T19:00:00Z"),
          venueName: "Test Venue 1",
          city: "Sydney",
          description: "Existing event 1",
          categoryTags: ["test"],
          sourceWebsite: "https://test1.com",
          originalEventUrl: "https://test1.com/event1",
          status: "imported",
          lastScrapedAt: new Date(),
        },
        {
          title: "Existing Event 2",
          dateTime: new Date("2024-11-02T20:00:00Z"),
          venueName: "Test Venue 2",
          city: "Sydney",
          description: "Existing event 2",
          categoryTags: ["test"],
          sourceWebsite: "https://test2.com",
          originalEventUrl: "https://test2.com/event2",
          status: "imported",
          lastScrapedAt: new Date(),
        },
      ]);

      // Step 2: Verify public site works normally
      const normalResponse = await request(app).get("/api/events").expect(200);

      expect(normalResponse.body.data.events).toHaveLength(2);

      // Step 3: Simulate scraper failure by creating failed scraping log
      const failedLog = await ScrapingLog.createLog("failed-source.com");
      await failedLog.markFailed("Network timeout error");

      // Step 4: Verify public site still works despite scraper failure
      const resilientResponse = await request(app)
        .get("/api/events")
        .expect(200);

      expect(resilientResponse.body.data.events).toHaveLength(2);
      expect(resilientResponse.body.success).toBe(true);

      // Step 5: Verify system health indicates degraded state but still operational
      const healthResponse = await request(app)
        .get("/health/detailed")
        .expect(200);

      expect(healthResponse.body.success).toBe(true);
      // System should still be operational even with scraper issues
    });

    it("should handle database connection recovery", async () => {
      // Step 1: Test normal operation
      const normalResponse = await request(app).get("/api/events").expect(200);

      expect(normalResponse.body.success).toBe(true);

      // Step 2: Simulate database disconnection
      await database.disconnect();

      // Step 3: Verify graceful degradation
      const degradedResponse = await request(app)
        .get("/api/events")
        .expect(503);

      expect(degradedResponse.body.success).toBe(false);

      // Step 4: Reconnect database
      await database.connect();

      // Step 5: Verify recovery
      const recoveredResponse = await request(app)
        .get("/api/events")
        .expect(200);

      expect(recoveredResponse.body.success).toBe(true);
    });
  });

  describe("Authentication and Authorization Flow", () => {
    it("should handle complete OAuth workflow simulation", async () => {
      // Step 1: Test unauthenticated access to admin routes
      const unauthResponse = await request(app)
        .get("/api/admin/events")
        .expect(401);

      expect(unauthResponse.body.success).toBe(false);

      // Step 2: Simulate successful OAuth by creating user
      const oauthUser = new User({
        googleId: "oauth-test-789",
        email: "oauth@example.com",
        name: "OAuth Test User",
        profilePicture: "https://lh3.googleusercontent.com/test",
      });
      await oauthUser.save();

      // Step 3: Verify user creation
      const createdUser = await User.findOne({ googleId: "oauth-test-789" });
      expect(createdUser).toBeTruthy();
      expect(createdUser!.email).toBe("oauth@example.com");

      // Step 4: Test user info endpoint (simulating authenticated session)
      const userInfoResponse = await request(app).get("/auth/user").expect(200);

      // Note: In a real test, we would need to simulate the session
      // For now, we verify the endpoint exists and handles unauthenticated requests
      expect(userInfoResponse.body).toBeTruthy();
    });
  });

  describe("Data Integrity and Validation", () => {
    it("should maintain data consistency across all operations", async () => {
      // Step 1: Create events with various statuses
      const testEvents = await Event.insertMany([
        {
          title: "Event A",
          dateTime: new Date("2024-12-01T18:00:00Z"),
          venueName: "Venue A",
          city: "Sydney",
          description: "Event A description",
          categoryTags: ["test"],
          sourceWebsite: "https://testa.com",
          originalEventUrl: "https://testa.com/event",
          status: "new",
          lastScrapedAt: new Date(),
        },
        {
          title: "Event B",
          dateTime: new Date("2024-12-02T19:00:00Z"),
          venueName: "Venue B",
          city: "Sydney",
          description: "Event B description",
          categoryTags: ["test"],
          sourceWebsite: "https://testb.com",
          originalEventUrl: "https://testb.com/event",
          status: "updated",
          lastScrapedAt: new Date(),
        },
      ]);

      const initialCount = await Event.countDocuments();
      expect(initialCount).toBe(2);

      // Step 2: Perform various operations
      const emailCaptures = await EmailCapture.insertMany([
        {
          email: "user1@example.com",
          consentGiven: true,
          eventId: testEvents[0]._id,
          capturedAt: new Date(),
        },
        {
          email: "user2@example.com",
          consentGiven: true,
          eventId: testEvents[1]._id,
          capturedAt: new Date(),
        },
      ]);

      // Step 3: Import one event
      await Event.findByIdAndUpdate(testEvents[0]._id, {
        status: "imported",
        importedAt: new Date(),
        importNotes: "Test import",
      });

      // Step 4: Verify data integrity
      const finalCount = await Event.countDocuments();
      expect(finalCount).toBe(initialCount); // No events should be deleted

      const emailCaptureCount = await EmailCapture.countDocuments();
      expect(emailCaptureCount).toBe(2);

      // Step 5: Verify referential integrity
      const eventWithCaptures = await Event.findById(testEvents[0]._id);
      const relatedCaptures = await EmailCapture.find({
        eventId: testEvents[0]._id,
      });

      expect(eventWithCaptures).toBeTruthy();
      expect(relatedCaptures).toHaveLength(1);
      expect(relatedCaptures[0].email).toBe("user1@example.com");

      // Step 6: Test cascade operations don't break integrity
      const publicEventsResponse = await request(app)
        .get("/api/events")
        .expect(200);

      expect(publicEventsResponse.body.data.events).toHaveLength(2);

      const adminEventsResponse = await request(app)
        .get("/api/admin/events")
        .expect(200);

      expect(adminEventsResponse.body.data.events).toHaveLength(2);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle multiple concurrent requests efficiently", async () => {
      // Create test events
      const events = Array.from({ length: 10 }, (_, i) => ({
        title: `Performance Test Event ${i + 1}`,
        dateTime: new Date(
          `2024-12-${String(i + 1).padStart(2, "0")}T18:00:00Z`,
        ),
        venueName: `Test Venue ${i + 1}`,
        city: "Sydney",
        description: `Performance test event ${i + 1}`,
        categoryTags: ["performance", "test"],
        sourceWebsite: `https://test${i + 1}.com`,
        originalEventUrl: `https://test${i + 1}.com/event`,
        status: "new",
        lastScrapedAt: new Date(),
      }));

      await Event.insertMany(events);

      // Test concurrent requests
      const concurrentRequests = Array.from({ length: 5 }, () =>
        request(app).get("/api/events").expect(200),
      );

      const responses = await Promise.all(concurrentRequests);

      // Verify all requests succeeded
      responses.forEach((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.events).toHaveLength(10);
      });

      // Test pagination performance
      const paginatedResponse = await request(app)
        .get("/api/events?limit=5&offset=0")
        .expect(200);

      expect(paginatedResponse.body.data.events).toHaveLength(5);
      expect(paginatedResponse.body.data.pagination.hasMore).toBe(true);

      const nextPageResponse = await request(app)
        .get("/api/events?limit=5&offset=5")
        .expect(200);

      expect(nextPageResponse.body.data.events).toHaveLength(5);
      expect(nextPageResponse.body.data.pagination.hasMore).toBe(false);
    });
  });
});

import request from "supertest";
import { createApp } from "../app";
import { database } from "../config/database";
import { Event } from "../models/Event";

describe("Basic Integration Test", () => {
  let app: any;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI =
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/sydney-events-basic-test";

    // Connect to database
    await database.connect();
    await database.clearDatabase();

    // Create app
    app = createApp();
  });

  afterAll(async () => {
    await database.clearDatabase();
    await database.disconnect();
  });

  beforeEach(async () => {
    await database.clearDatabase();
  });

  describe("Basic System Integration", () => {
    it("should handle basic event creation and API access", async () => {
      // Create a test event with valid data
      const testEvent = await Event.create({
        title: "Basic Integration Test Event",
        dateTime: new Date("2024-06-01T19:00:00Z"),
        venueName: "Test Venue",
        city: "Sydney",
        description: "Test event for basic integration",
        categoryTags: ["test", "integration"],
        sourceWebsite: "https://test.com",
        originalEventUrl: "https://test.com/event",
        status: "new",
        lastScrapedAt: new Date(),
      });

      expect(testEvent._id).toBeTruthy();
      expect(testEvent.title).toBe("Basic Integration Test Event");

      // Test API endpoint
      const response = await request(app).get("/api/events").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0].title).toBe(
        "Basic Integration Test Event",
      );
    });

    it("should handle health check endpoints", async () => {
      const healthResponse = await request(app).get("/health").expect(200);

      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data.environment).toBe("test");
    });

    it("should handle email capture with valid data", async () => {
      // Create test event first
      const testEvent = await Event.create({
        title: "Email Test Event",
        dateTime: new Date("2024-06-01T19:00:00Z"),
        venueName: "Email Test Venue",
        city: "Sydney",
        description: "Test event for email capture",
        categoryTags: ["test"],
        sourceWebsite: "https://emailtest.com",
        originalEventUrl: "https://emailtest.com/event",
        status: "new",
        lastScrapedAt: new Date(),
      });

      // Test email capture
      const emailResponse = await request(app)
        .post("/api/email-capture")
        .send({
          email: "test@example.com",
          consentGiven: true,
          eventId: testEvent._id.toString(),
        })
        .expect(200);

      expect(emailResponse.body.success).toBe(true);
      expect(emailResponse.body.data.redirectUrl).toBe(
        "https://emailtest.com/event",
      );
    });

    it("should handle admin authentication requirement", async () => {
      const adminResponse = await request(app)
        .get("/api/admin/events")
        .expect(401);

      expect(adminResponse.body.success).toBe(false);
      expect(adminResponse.body.error).toContain(
        "Admin authentication required",
      );
    });
  });
});

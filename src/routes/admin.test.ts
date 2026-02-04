import request from "supertest";
import { createApp } from "../app";
import { Event } from "../models/Event";
import { User } from "../models/User";
import { EventStatus } from "../types";
import { database } from "../config/database";
import { Types } from "mongoose";

// Mock authentication middleware
jest.mock("../middleware/auth", () => ({
  requireAdminAuth: (req: any, res: any, next: any) => {
    req.user = {
      _id: new Types.ObjectId(),
      name: "Test Admin",
      email: "admin@test.com",
    };
    next();
  },
}));

describe("Admin Routes - Event Import", () => {
  let app: any;

  beforeAll(async () => {
    await database.connect();
    app = createApp();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  beforeEach(async () => {
    await Event.deleteMany({});
    await User.deleteMany({});
  });

  describe("PUT /api/admin/events/:id/import", () => {
    it("should successfully import an event", async () => {
      // Create a test event
      const testEvent = new Event({
        title: "Test Event",
        dateTime: new Date("2024-12-25T19:00:00Z"),
        venueName: "Test Venue",
        city: "Sydney",
        description: "Test event description",
        categoryTags: ["test"],
        sourceWebsite: "https://test.com",
        originalEventUrl: "https://test.com/event/1",
        status: EventStatus.NEW,
        lastScrapedAt: new Date(),
      });
      await testEvent.save();

      const response = await request(app)
        .put(`/api/admin/events/${testEvent._id}/import`)
        .send({
          importNotes: "Test import notes",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(EventStatus.IMPORTED);
      expect(response.body.data.importNotes).toBe("Test import notes");
      expect(response.body.data.importedAt).toBeDefined();
      expect(response.body.data.importedBy).toBeDefined();
    });

    it("should reject import of already imported event", async () => {
      // Create an already imported event
      const testEvent = new Event({
        title: "Test Event",
        dateTime: new Date("2024-12-25T19:00:00Z"),
        venueName: "Test Venue",
        city: "Sydney",
        description: "Test event description",
        categoryTags: ["test"],
        sourceWebsite: "https://test.com",
        originalEventUrl: "https://test.com/event/1",
        status: EventStatus.IMPORTED,
        lastScrapedAt: new Date(),
        importedAt: new Date(),
        importedBy: new Types.ObjectId(),
      });
      await testEvent.save();

      const response = await request(app)
        .put(`/api/admin/events/${testEvent._id}/import`)
        .send({
          importNotes: "Test import notes",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Event already imported");
    });

    it("should return 404 for non-existent event", async () => {
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .put(`/api/admin/events/${nonExistentId}/import`)
        .send({
          importNotes: "Test import notes",
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Event not found");
    });

    it("should return 400 for invalid event ID", async () => {
      const response = await request(app)
        .put("/api/admin/events/invalid-id/import")
        .send({
          importNotes: "Test import notes",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid event ID");
    });
  });
});

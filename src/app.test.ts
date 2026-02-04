import request from "supertest";
import { createApp } from "./app";
import { Application } from "express";

// Mock the database module to avoid MongoDB connection in tests
jest.mock("./config/database", () => ({
  database: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    getConnectionStatus: jest.fn().mockReturnValue(true),
    clearDatabase: jest.fn(),
  },
}));

// Mock the Event model to avoid database operations
jest.mock("./models/Event", () => ({
  Event: {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
    countDocuments: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    }),
  },
}));

// Mock the EmailCapture model
jest.mock("./models/EmailCapture", () => ({
  EmailCapture: jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({}),
  })),
}));

describe("Express App", () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe("Health Check", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Sydney Events Aggregator API is running",
        data: {
          environment: "test",
          version: "1.0.0",
        },
      });

      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
    });
  });

  describe("404 Handler", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await request(app).get("/unknown-route").expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: "Route GET /unknown-route not found",
      });
    });
  });

  describe("API Routes", () => {
    it("should return events list from /api/events", async () => {
      const response = await request(app).get("/api/events").expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          events: [],
          pagination: {
            total: 0,
            limit: 50,
            offset: 0,
            hasMore: false,
          },
        },
        message: "Found 0 events",
      });
    });

    it("should return 400 for invalid event ID", async () => {
      const response = await request(app)
        .get("/api/events/invalid-id")
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: "Invalid event ID format",
      });
    });

    it("should return 400 for missing email capture data", async () => {
      const response = await request(app)
        .post("/api/email-capture")
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: "Email, explicit consent, and event ID are required",
      });
    });
  });
});

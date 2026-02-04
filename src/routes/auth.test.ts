import request from "supertest";
import { createApp } from "../app";
import { DatabaseConnection } from "../config/database";
import { User } from "../models/User";

describe("Authentication Routes", () => {
  let app: any;

  beforeAll(async () => {
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.connect();
    app = createApp();
  });

  afterAll(async () => {
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.disconnect();
  });

  beforeEach(async () => {
    // Clean up users before each test
    await User.deleteMany({});
  });

  describe("GET /auth/google", () => {
    it("should redirect to Google OAuth", async () => {
      const response = await request(app).get("/auth/google").expect(302);

      expect(response.headers.location).toContain("accounts.google.com");
    });
  });

  describe("GET /auth/user", () => {
    it("should return null for unauthenticated user", async () => {
      const response = await request(app).get("/auth/user").expect(200);

      expect(response.body).toEqual({
        success: true,
        data: null,
        message: "No user authenticated",
      });
    });
  });

  describe("GET /auth/status", () => {
    it("should return authentication status", async () => {
      const response = await request(app).get("/auth/status").expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          isAuthenticated: false,
          user: null,
        },
        message: "User is not authenticated",
      });
    });
  });

  describe("POST /auth/logout", () => {
    it("should handle logout for unauthenticated user", async () => {
      const response = await request(app).post("/auth/logout").expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Successfully logged out",
      });
    });
  });
});

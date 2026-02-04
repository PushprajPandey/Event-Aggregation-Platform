import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
  },
  database: {
    uri:
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/sydney-events-aggregator",
    testUri:
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/sydney-events-aggregator-test",
  },
  auth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    sessionSecret: process.env.SESSION_SECRET || "default-session-secret",
  },
  cors: {
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3001",
  },
  scraper: {
    schedule: process.env.SCRAPER_SCHEDULE || "0 */6 * * *", // Every 6 hours
    timeout: parseInt(process.env.SCRAPER_TIMEOUT || "30000", 10), // 30 seconds
  },
};

// Validate required environment variables in production
export function validateEnvironment(): void {
  const requiredVars = [
    "MONGODB_URI",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "SESSION_SECRET",
  ];

  if (config.server.nodeEnv === "production") {
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}`,
      );
    }
  }
}

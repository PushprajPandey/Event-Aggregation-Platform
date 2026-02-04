import { DatabaseConnection } from "./database";

// Mock mongoose to avoid actual database connection
jest.mock("mongoose", () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  connection: {
    readyState: 1,
    collections: {},
    on: jest.fn(),
  },
}));

describe("Database Connection", () => {
  let database: DatabaseConnection;

  beforeEach(() => {
    database = DatabaseConnection.getInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = DatabaseConnection.getInstance();
      const instance2 = DatabaseConnection.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Connection Management", () => {
    it("should have connect method", () => {
      expect(typeof database.connect).toBe("function");
    });

    it("should have disconnect method", () => {
      expect(typeof database.disconnect).toBe("function");
    });

    it("should have getConnectionStatus method", () => {
      expect(typeof database.getConnectionStatus).toBe("function");
    });

    it("should have clearDatabase method", () => {
      expect(typeof database.clearDatabase).toBe("function");
    });
  });
});

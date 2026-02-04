import { ScraperEngine, ScrapingSourceConfig } from "./ScraperEngine";
import { DataNormalizer } from "./DataNormalizer";
import { ErrorHandler, ErrorCategory } from "./ErrorHandler";
import { EventData } from "../types";

describe("ScraperEngine", () => {
  let scraperEngine: ScraperEngine;
  let mockLogger: jest.Mock;

  beforeEach(() => {
    mockLogger = jest.fn();
    scraperEngine = new ScraperEngine([], mockLogger);
  });

  describe("constructor", () => {
    it("should initialize with empty sources and custom logger", () => {
      expect(scraperEngine.getSources()).toEqual([]);
      expect(mockLogger).not.toHaveBeenCalled();
    });

    it("should initialize with default logger when none provided", () => {
      const engine = new ScraperEngine();
      expect(engine.getSources()).toEqual([]);
    });
  });

  describe("addSource", () => {
    it("should add a scraping source configuration", () => {
      const source: ScrapingSourceConfig = {
        name: "Test Source",
        url: "https://example.com",
        selectors: {
          eventContainer: ".event",
          title: ".title",
          dateTime: ".date",
          venueName: ".venue",
          description: ".description",
          originalEventUrl: "a",
        },
      };

      scraperEngine.addSource(source);

      expect(scraperEngine.getSources()).toHaveLength(1);
      expect(scraperEngine.getSources()[0]).toEqual(source);
      expect(mockLogger).toHaveBeenCalledWith(
        "Added scraping source: Test Source",
        "info",
      );
    });
  });

  describe("removeSource", () => {
    it("should remove a source by name", () => {
      const source: ScrapingSourceConfig = {
        name: "Test Source",
        url: "https://example.com",
        selectors: {
          eventContainer: ".event",
          title: ".title",
          dateTime: ".date",
          venueName: ".venue",
          description: ".description",
          originalEventUrl: "a",
        },
      };

      scraperEngine.addSource(source);
      expect(scraperEngine.getSources()).toHaveLength(1);

      const removed = scraperEngine.removeSource("Test Source");

      expect(removed).toBe(true);
      expect(scraperEngine.getSources()).toHaveLength(0);
      expect(mockLogger).toHaveBeenCalledWith(
        "Removed scraping source: Test Source",
        "info",
      );
    });

    it("should return false when trying to remove non-existent source", () => {
      const removed = scraperEngine.removeSource("Non-existent");

      expect(removed).toBe(false);
      expect(scraperEngine.getSources()).toHaveLength(0);
    });
  });

  describe("validateEventData", () => {
    it("should validate complete event data", () => {
      const validEventData: EventData = {
        title: "Test Event",
        dateTime: new Date(Date.now() + 86400000), // Tomorrow
        venueName: "Test Venue",
        city: "Sydney",
        description: "Test Description",
        categoryTags: ["music", "concert"],
        sourceWebsite: "Test Source",
        originalEventUrl: "https://example.com/event",
        lastScrapedAt: new Date(),
      };

      // Access private method through any cast for testing
      const isValid = (scraperEngine as any).validateEventData(validEventData);
      expect(isValid).toBe(true);
    });

    it("should reject event data with missing required fields", () => {
      const invalidEventData: Partial<EventData> = {
        title: "Test Event",
        // Missing dateTime
        venueName: "Test Venue",
        city: "Sydney",
        description: "Test Description",
        categoryTags: [],
        sourceWebsite: "Test Source",
        originalEventUrl: "https://example.com/event",
        lastScrapedAt: new Date(),
      };

      const isValid = (scraperEngine as any).validateEventData(
        invalidEventData,
      );
      expect(isValid).toBe(false);
    });

    it("should reject event data with invalid URL", () => {
      const invalidEventData: EventData = {
        title: "Test Event",
        dateTime: new Date(Date.now() + 86400000),
        venueName: "Test Venue",
        city: "Sydney",
        description: "Test Description",
        categoryTags: [],
        sourceWebsite: "Test Source",
        originalEventUrl: "invalid-url",
        lastScrapedAt: new Date(),
      };

      const isValid = (scraperEngine as any).validateEventData(
        invalidEventData,
      );
      expect(isValid).toBe(false);
    });

    it("should reject event data with past date", () => {
      const invalidEventData: EventData = {
        title: "Test Event",
        dateTime: new Date(Date.now() - 2 * 86400000), // Two days ago
        venueName: "Test Venue",
        city: "Sydney",
        description: "Test Description",
        categoryTags: [],
        sourceWebsite: "Test Source",
        originalEventUrl: "https://example.com/event",
        lastScrapedAt: new Date(),
      };

      const isValid = (scraperEngine as any).validateEventData(
        invalidEventData,
      );
      expect(isValid).toBe(false);
    });
  });
});

describe("DataNormalizer", () => {
  describe("normalizeEventData", () => {
    it("should normalize event data fields", () => {
      const eventData: EventData = {
        title: "  Test   Event  ",
        dateTime: new Date(),
        venueName: "  Test  Venue  ",
        venueAddress: "  123  Main  St  ",
        city: "  sydney  ",
        description: "  Test  description  with  extra  spaces  ",
        categoryTags: ["  MUSIC  ", "concert", "  MUSIC  "], // Duplicates and case issues
        sourceWebsite: "Test Source",
        originalEventUrl: "https://example.com/event",
        imageUrl: "https://example.com/image.jpg",
        lastScrapedAt: new Date(),
      };

      const normalized = DataNormalizer.normalizeEventData(eventData);

      expect(normalized.title).toBe("Test Event");
      expect(normalized.venueName).toBe("Test Venue");
      expect(normalized.venueAddress).toBe("123 Main St");
      expect(normalized.city).toBe("sydney");
      expect(normalized.description).toBe("Test description with extra spaces");
      expect(normalized.categoryTags).toEqual(["music", "concert"]);
    });

    it("should default city to Sydney when empty", () => {
      const eventData: EventData = {
        title: "Test Event",
        dateTime: new Date(),
        venueName: "Test Venue",
        city: "",
        description: "Test description",
        categoryTags: [],
        sourceWebsite: "Test Source",
        originalEventUrl: "https://example.com/event",
        lastScrapedAt: new Date(),
      };

      const normalized = DataNormalizer.normalizeEventData(eventData);
      expect(normalized.city).toBe("Sydney");
    });
  });

  describe("validateNormalizedData", () => {
    it("should validate complete normalized data", () => {
      const eventData: EventData = {
        title: "Test Event",
        dateTime: new Date(Date.now() + 86400000),
        venueName: "Test Venue",
        city: "Sydney",
        description: "Test description",
        categoryTags: ["music"],
        sourceWebsite: "Test Source",
        originalEventUrl: "https://example.com/event",
        lastScrapedAt: new Date(),
      };

      const result = DataNormalizer.validateNormalizedData(eventData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return validation errors for incomplete data", () => {
      const eventData: Partial<EventData> = {
        title: "",
        // Missing other required fields
      };

      const result = DataNormalizer.validateNormalizedData(
        eventData as EventData,
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain("Title is required");
    });
  });

  describe("cleanHtmlContent", () => {
    it("should remove HTML tags and normalize whitespace", () => {
      const htmlContent =
        "<p>Test <strong>content</strong> with &nbsp; HTML</p>";
      const cleaned = DataNormalizer.cleanHtmlContent(htmlContent);
      expect(cleaned).toBe("Test content with HTML");
    });
  });
});

describe("ErrorHandler", () => {
  describe("categorizeError", () => {
    it("should categorize network errors correctly", () => {
      const networkError = new Error("ECONNREFUSED");
      (networkError as any).code = "ECONNREFUSED";

      const categorized = ErrorHandler.categorizeError(
        networkError,
        "https://example.com",
      );

      expect(categorized.category).toBe(ErrorCategory.NETWORK);
      expect(categorized.retryable).toBe(true);
      expect(categorized.severity).toBe("high");
      expect(categorized.url).toBe("https://example.com");
    });

    it("should categorize timeout errors correctly", () => {
      const timeoutError = new Error("Request timeout");

      const categorized = ErrorHandler.categorizeError(timeoutError);

      expect(categorized.category).toBe(ErrorCategory.TIMEOUT);
      expect(categorized.retryable).toBe(true);
      expect(categorized.severity).toBe("medium");
    });

    it("should categorize parsing errors correctly", () => {
      const parsingError = new Error("Parsing error: selector not found");

      const categorized = ErrorHandler.categorizeError(parsingError);

      expect(categorized.category).toBe(ErrorCategory.PARSING);
      expect(categorized.retryable).toBe(false);
      expect(categorized.severity).toBe("low");
    });

    it("should categorize unknown errors correctly", () => {
      const unknownError = new Error("Some unknown error");

      const categorized = ErrorHandler.categorizeError(unknownError);

      expect(categorized.category).toBe(ErrorCategory.UNKNOWN);
      expect(categorized.retryable).toBe(false);
      expect(categorized.severity).toBe("medium");
    });
  });

  describe("createErrorSummary", () => {
    it("should create correct error summary", () => {
      const errors = [
        ErrorHandler.categorizeError(new Error("Network error")),
        ErrorHandler.categorizeError(new Error("Parsing error")),
        ErrorHandler.categorizeError(new Error("Network error")),
      ];

      // Mock the categorization for predictable results
      errors[0].category = ErrorCategory.NETWORK;
      errors[0].severity = "high";
      errors[0].retryable = true;

      errors[1].category = ErrorCategory.PARSING;
      errors[1].severity = "low";
      errors[1].retryable = false;

      errors[2].category = ErrorCategory.NETWORK;
      errors[2].severity = "high";
      errors[2].retryable = true;

      const summary = ErrorHandler.createErrorSummary(errors);

      expect(summary.total).toBe(3);
      expect(summary.byCategory[ErrorCategory.NETWORK]).toBe(2);
      expect(summary.byCategory[ErrorCategory.PARSING]).toBe(1);
      expect(summary.bySeverity.high).toBe(2);
      expect(summary.bySeverity.low).toBe(1);
      expect(summary.retryableCount).toBe(2);
    });
  });

  describe("shouldContinueScraping", () => {
    it("should return false for too many high severity errors", () => {
      const errors = Array(6)
        .fill(null)
        .map(() => {
          const error = ErrorHandler.categorizeError(
            new Error("High severity error"),
          );
          error.severity = "high";
          return error;
        });

      const shouldContinue = ErrorHandler.shouldContinueScraping(errors);
      expect(shouldContinue).toBe(false);
    });

    it("should return false for too many network errors", () => {
      const errors = Array(11)
        .fill(null)
        .map(() => {
          const error = ErrorHandler.categorizeError(
            new Error("Network error"),
          );
          error.category = ErrorCategory.NETWORK;
          return error;
        });

      const shouldContinue = ErrorHandler.shouldContinueScraping(errors);
      expect(shouldContinue).toBe(false);
    });

    it("should return true for manageable error levels", () => {
      const errors = [
        ErrorHandler.categorizeError(new Error("Parsing error")),
        ErrorHandler.categorizeError(new Error("Validation error")),
      ];

      errors[0].category = ErrorCategory.PARSING;
      errors[0].severity = "low";
      errors[1].category = ErrorCategory.VALIDATION;
      errors[1].severity = "low";

      const shouldContinue = ErrorHandler.shouldContinueScraping(errors);
      expect(shouldContinue).toBe(true);
    });
  });
});

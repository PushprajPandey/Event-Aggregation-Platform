import { ScraperEngine, StatusManager, ScrapingSourceConfig } from "./index";
import { EventData } from "../types";

/**
 * Example demonstrating how to use the StatusManager with ScraperEngine
 * This shows the integration between scraping and status management
 */
async function demonstrateStatusManagement() {
  console.log("=== Status Management Integration Example ===\n");

  // Create a custom logger for demonstration
  const logger = (
    message: string,
    level: "info" | "warn" | "error" = "info",
  ) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  };

  // Create StatusManager and ScraperEngine instances
  const statusManager = new StatusManager(logger);
  const scraperEngine = new ScraperEngine([], logger, statusManager);

  // Example scraping source configuration
  const exampleSource: ScrapingSourceConfig = {
    name: "Example Events",
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
  };

  scraperEngine.addSource(exampleSource);

  console.log("1. Demonstrating Status Transition Validation:");
  console.log("-------------------------------------------");

  // Test valid status transitions
  const validTransitions = [
    { from: "new", to: "updated" },
    { from: "new", to: "inactive" },
    { from: "new", to: "imported" },
    { from: "updated", to: "inactive" },
    { from: "updated", to: "imported" },
    { from: "inactive", to: "imported" },
  ];

  validTransitions.forEach(({ from, to }) => {
    const result = statusManager.validateStatusTransition(
      from as any,
      to as any,
    );
    console.log(`  ${from} → ${to}: ${result.valid ? "✓ Valid" : "✗ Invalid"}`);
  });

  // Test invalid transitions
  console.log("\n  Invalid transitions:");
  const invalidTransitions = [
    { from: "imported", to: "new" },
    { from: "imported", to: "updated" },
    { from: "new", to: "new" },
  ];

  invalidTransitions.forEach(({ from, to }) => {
    const result = statusManager.validateStatusTransition(
      from as any,
      to as any,
    );
    console.log(
      `  ${from} → ${to}: ${result.valid ? "✓ Valid" : "✗ Invalid"} ${result.reason ? `(${result.reason})` : ""}`,
    );
  });

  console.log("\n2. Demonstrating Change Detection:");
  console.log("--------------------------------");

  // Simulate scraped events data
  const mockScrapedEvents: EventData[] = [
    {
      title: "Sydney Music Festival 2024",
      dateTime: new Date("2024-06-15T19:00:00Z"),
      venueName: "Sydney Opera House",
      venueAddress: "Bennelong Point, Sydney NSW 2000",
      city: "Sydney",
      description:
        "Annual music festival featuring local and international artists",
      categoryTags: ["music", "festival", "outdoor"],
      imageUrl: "https://example.com/images/music-festival.jpg",
      sourceWebsite: "Example Events",
      originalEventUrl: "https://example.com/events/music-festival-2024",
      lastScrapedAt: new Date(),
    },
    {
      title: "Tech Conference Sydney",
      dateTime: new Date("2024-07-20T09:00:00Z"),
      venueName: "International Convention Centre",
      venueAddress: "14 Darling Dr, Sydney NSW 2000",
      city: "Sydney",
      description: "Leading technology conference with industry experts",
      categoryTags: ["technology", "conference", "networking"],
      sourceWebsite: "Example Events",
      originalEventUrl: "https://example.com/events/tech-conference",
      lastScrapedAt: new Date(),
    },
  ];

  console.log(
    `  Simulating processing of ${mockScrapedEvents.length} scraped events...`,
  );

  // Note: In a real scenario, this would interact with the database
  // For demonstration, we'll show what the process would look like
  console.log("  - Checking for existing events in database...");
  console.log("  - Detecting new events...");
  console.log("  - Detecting updated events...");
  console.log("  - Detecting inactive events...");
  console.log("  - Applying status changes...");

  console.log("\n3. Status Statistics Example:");
  console.log("----------------------------");

  // Demonstrate status statistics (would normally come from database)
  const mockStats = {
    new: 15,
    updated: 8,
    inactive: 3,
    imported: 12,
  };

  console.log("  Current event status distribution:");
  Object.entries(mockStats).forEach(([status, count]) => {
    console.log(`    ${status.toUpperCase()}: ${count} events`);
  });

  console.log("\n4. Event Import Example:");
  console.log("-----------------------");

  // Simulate event import
  console.log("  Simulating admin importing an event...");
  console.log("  - Validating status transition...");
  console.log("  - Updating event status to 'imported'...");
  console.log("  - Recording import timestamp and user...");
  console.log("  - Adding import notes...");
  console.log("  ✓ Event successfully imported");

  console.log("\n5. Status Change Logging:");
  console.log("------------------------");

  // Demonstrate status change logging
  console.log("  Recent status changes:");
  console.log(
    "    Event #1: new → updated (Event data changed during scraping)",
  );
  console.log(
    "    Event #2: updated → imported (Event manually imported by admin)",
  );
  console.log(
    "    Event #3: new → inactive (Event no longer found on source website)",
  );

  console.log("\n=== Integration Complete ===");
  console.log(
    "\nThe StatusManager is now integrated with the ScraperEngine and provides:",
  );
  console.log("• Automatic status tracking during scraping");
  console.log("• Change detection for new, updated, and inactive events");
  console.log("• Status transition validation");
  console.log("• Comprehensive logging of all status changes");
  console.log("• Admin import functionality with audit trails");
  console.log("• Statistical reporting on event statuses");
}

// Export the demonstration function
export { demonstrateStatusManagement };

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateStatusManagement().catch(console.error);
}

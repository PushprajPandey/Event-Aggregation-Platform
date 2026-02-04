import { ScrapingService, ScrapingServiceConfig } from "./ScrapingService";
import { LogLevel } from "./ScrapingLogger";

/**
 * Example usage of the scheduled scraping system
 */
async function exampleUsage() {
  // Create configuration for the scraping service
  const config: ScrapingServiceConfig = {
    orchestrator: {
      defaultSchedule: {
        cronExpression: "0 */6 * * *", // Every 6 hours
        enabled: true,
        timezone: "Australia/Sydney",
        name: "sydney-events-schedule",
      },
      maxConcurrentScrapers: 3,
      retryFailedSources: true,
      retryDelay: 30000, // 30 seconds
      healthCheckInterval: 60000, // 1 minute
    },
    logger: {
      logLevel: LogLevel.INFO,
      logToConsole: true,
      logToFile: true,
      logDirectory: "./logs/scraping",
    },
    defaultSources: [
      {
        name: "Eventbrite Sydney",
        url: "https://www.eventbrite.com.au/d/australia--sydney/events/",
        selectors: {
          eventContainer: "[data-testid='event-card']",
          title: "[data-testid='event-title']",
          dateTime: "[data-testid='event-datetime']",
          venueName: "[data-testid='event-venue']",
          venueAddress: "[data-testid='venue-address']",
          description: "[data-testid='event-description']",
          categoryTags: "[data-testid='event-category']",
          imageUrl: "[data-testid='event-image'] img",
          originalEventUrl: "a[data-testid='event-link']",
        },
        baseUrl: "https://www.eventbrite.com.au",
      },
      {
        name: "Time Out Sydney",
        url: "https://www.timeout.com/sydney/things-to-do/events-in-sydney",
        selectors: {
          eventContainer: ".event-item",
          title: ".event-title h3",
          dateTime: ".event-date",
          venueName: ".event-venue",
          description: ".event-description",
          categoryTags: ".event-category",
          imageUrl: ".event-image img",
          originalEventUrl: ".event-link",
        },
        baseUrl: "https://www.timeout.com",
      },
    ],
  };

  // Create and initialize the scraping service
  const scrapingService = new ScrapingService(config);

  try {
    console.log("Initializing scraping service...");
    await scrapingService.initialize();

    console.log("Starting scheduled scraping...");
    await scrapingService.start();

    // Get initial health status
    const health = scrapingService.getHealth();
    console.log("Health status:", health);

    // Get scrapers status
    const scrapersStatus = scrapingService.getScrapersStatus();
    console.log("Scrapers status:", scrapersStatus);

    // Execute manual scraping to test the system
    console.log("Executing manual scraping...");
    const results = await scrapingService.executeManualScraping();

    console.log("Manual scraping results:");
    results.forEach((result, scraperName) => {
      console.log(`  ${scraperName}:`, {
        totalSources: result.totalSources,
        successfulSources: result.successfulSources,
        totalEvents: result.totalEvents,
        totalErrors: result.totalErrors,
        duration: `${Math.round(result.duration / 1000)}s`,
      });
    });

    // Add a new source dynamically
    console.log("Adding new source...");
    const newSource = {
      name: "What's On Sydney",
      url: "https://www.whatson.sydney/events",
      selectors: {
        eventContainer: ".event-card",
        title: ".event-title",
        dateTime: ".event-date",
        venueName: ".event-venue",
        description: ".event-description",
        originalEventUrl: ".event-link",
      },
      baseUrl: "https://www.whatson.sydney",
    };

    const sourceAdded = scrapingService.addSource("default", newSource);
    console.log("Source added:", sourceAdded);

    // Create a new scraper for a specific category
    console.log("Creating specialized scraper...");
    const musicSources = [
      {
        name: "Sydney Music Events",
        url: "https://example.com/music-events",
        selectors: {
          eventContainer: ".music-event",
          title: ".event-name",
          dateTime: ".event-time",
          venueName: ".venue",
          description: ".description",
          originalEventUrl: ".event-url",
        },
        baseUrl: "https://example.com",
      },
    ];

    const musicSchedule = {
      cronExpression: "0 */4 * * *", // Every 4 hours
      enabled: true,
      timezone: "Australia/Sydney",
      name: "music-events-schedule",
    };

    const scraperCreated = await scrapingService.createScraper(
      "music-events",
      musicSources,
      musicSchedule,
    );
    console.log("Music scraper created:", scraperCreated);

    // Let the system run for a while
    console.log("System running... Press Ctrl+C to stop");

    // Set up graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\nShutting down gracefully...");
      await scrapingService.shutdown();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\nShutting down gracefully...");
      await scrapingService.shutdown();
      process.exit(0);
    });

    // Keep the process running
    setInterval(() => {
      const health = scrapingService.getHealth();
      console.log(
        `Health check: ${health.isHealthy ? "✓" : "✗"} - Active: ${health.activeScrapers}/${health.totalScrapers}, Uptime: ${Math.round(health.uptime / 60000)}min`,
      );
    }, 60000); // Every minute
  } catch (error) {
    console.error("Error in scraping service:", error);
    await scrapingService.shutdown();
    process.exit(1);
  }
}

/**
 * Example of creating a simple scheduled scraper
 */
async function simpleExample() {
  // Use default configuration
  const config = ScrapingService.createDefaultConfig();

  // Customize for your needs
  config.orchestrator.defaultSchedule.cronExpression = "0 */2 * * *"; // Every 2 hours
  config.logger.logLevel = LogLevel.DEBUG;

  const scrapingService = new ScrapingService(config);

  try {
    await scrapingService.initialize();
    await scrapingService.start();

    console.log("Simple scraping service started!");
    console.log("Scrapers:", scrapingService.getScraperNames());

    // Execute one manual scraping cycle
    const results = await scrapingService.executeManualScraping();
    console.log("Results:", results);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await scrapingService.shutdown();
  }
}

// Export examples for use
export { exampleUsage, simpleExample };

// Run example if this file is executed directly
if (require.main === module) {
  console.log("Running scraping service example...");
  exampleUsage().catch(console.error);
}

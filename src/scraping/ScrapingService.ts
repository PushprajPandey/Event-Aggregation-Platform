import {
  ScraperOrchestrator,
  OrchestratorConfig,
  OrchestratorHealth,
} from "./ScraperOrchestrator";
import {
  ScheduledScraper,
  ScheduleConfig,
  OrchestrationResult,
} from "./ScheduledScraper";
import { ScraperEngine, ScrapingSourceConfig } from "./ScraperEngine";
import { StatusManager } from "./StatusManager";
import { ScrapingLogger, LogLevel } from "./ScrapingLogger";

/**
 * Configuration for the scraping service
 */
export interface ScrapingServiceConfig {
  orchestrator: OrchestratorConfig;
  logger: {
    logLevel: LogLevel;
    logToConsole: boolean;
    logToFile: boolean;
    logDirectory: string;
  };
  defaultSources: ScrapingSourceConfig[];
}

/**
 * Main scraping service that provides a unified interface for all scraping operations
 */
export class ScrapingService {
  private orchestrator: ScraperOrchestrator;
  private logger: ScrapingLogger;
  private isInitialized: boolean = false;

  constructor(config: ScrapingServiceConfig) {
    // Initialize logger
    this.logger = new ScrapingLogger(config.logger);

    // Initialize orchestrator with logger
    this.orchestrator = new ScraperOrchestrator(
      config.orchestrator,
      this.logger.createSimpleLogger("ScraperOrchestrator"),
    );
  }

  /**
   * Initialize the scraping service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn(
        "ScrapingService already initialized",
        "ScrapingService",
      );
      return;
    }

    try {
      this.logger.info("Initializing ScrapingService", "ScrapingService");

      // Initialize the orchestrator
      await this.orchestrator.initialize();

      this.isInitialized = true;
      this.logger.info(
        "ScrapingService initialized successfully",
        "ScrapingService",
      );
    } catch (error) {
      this.logger.error(
        "Failed to initialize ScrapingService",
        "ScrapingService",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Start all scheduled scrapers
   */
  async start(): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info("Starting ScrapingService", "ScrapingService");
      await this.orchestrator.startAll();
      this.logger.info(
        "ScrapingService started successfully",
        "ScrapingService",
      );
    } catch (error) {
      this.logger.error(
        "Failed to start ScrapingService",
        "ScrapingService",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Stop all scheduled scrapers
   */
  async stop(): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info("Stopping ScrapingService", "ScrapingService");
      await this.orchestrator.stopAll();
      this.logger.info(
        "ScrapingService stopped successfully",
        "ScrapingService",
      );
    } catch (error) {
      this.logger.error(
        "Failed to stop ScrapingService",
        "ScrapingService",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Execute manual scraping for all scrapers
   */
  async executeManualScraping(): Promise<Map<string, OrchestrationResult>> {
    this.ensureInitialized();

    try {
      this.logger.info("Executing manual scraping", "ScrapingService");
      const results = await this.orchestrator.executeManualScrapingAll();

      // Log summary of results
      let totalEvents = 0;
      let totalErrors = 0;
      let successfulScrapers = 0;

      results.forEach((result, scraperName) => {
        totalEvents += result.totalEvents;
        totalErrors += result.totalErrors;
        if (result.successfulSources > 0) {
          successfulScrapers++;
        }
      });

      this.logger.info("Manual scraping completed", "ScrapingService", {
        totalScrapers: results.size,
        successfulScrapers,
        totalEvents,
        totalErrors,
      });

      return results;
    } catch (error) {
      this.logger.error(
        "Failed to execute manual scraping",
        "ScrapingService",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Execute manual scraping for a specific scraper
   */
  async executeManualScrapingForScraper(
    scraperName: string,
  ): Promise<OrchestrationResult | null> {
    this.ensureInitialized();

    try {
      this.logger.info(
        `Executing manual scraping for scraper: ${scraperName}`,
        "ScrapingService",
      );

      const result = await this.orchestrator.executeManualScraping(scraperName);

      if (result) {
        this.logger.info(
          `Manual scraping completed for ${scraperName}`,
          "ScrapingService",
          {
            successfulSources: result.successfulSources,
            totalSources: result.totalSources,
            totalEvents: result.totalEvents,
            totalErrors: result.totalErrors,
            duration: Math.round(result.duration / 1000),
          },
        );
      } else {
        this.logger.warn(
          `Scraper not found: ${scraperName}`,
          "ScrapingService",
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to execute manual scraping for ${scraperName}`,
        "ScrapingService",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Add a new scraping source to a specific scraper
   */
  addSource(scraperName: string, source: ScrapingSourceConfig): boolean {
    this.ensureInitialized();

    try {
      const success = this.orchestrator.addSourceToScraper(scraperName, source);

      if (success) {
        this.logger.info(
          `Added source '${source.name}' to scraper '${scraperName}'`,
          "ScrapingService",
          { sourceUrl: source.url },
        );
      } else {
        this.logger.warn(
          `Failed to add source '${source.name}' to scraper '${scraperName}' - scraper not found`,
          "ScrapingService",
        );
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Error adding source to scraper`,
        "ScrapingService",
        error instanceof Error ? error : new Error(String(error)),
        { scraperName, sourceName: source.name },
      );
      return false;
    }
  }

  /**
   * Remove a scraping source from a specific scraper
   */
  removeSource(scraperName: string, sourceName: string): boolean {
    this.ensureInitialized();

    try {
      const success = this.orchestrator.removeSourceFromScraper(
        scraperName,
        sourceName,
      );

      if (success) {
        this.logger.info(
          `Removed source '${sourceName}' from scraper '${scraperName}'`,
          "ScrapingService",
        );
      } else {
        this.logger.warn(
          `Failed to remove source '${sourceName}' from scraper '${scraperName}' - scraper or source not found`,
          "ScrapingService",
        );
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Error removing source from scraper`,
        "ScrapingService",
        error instanceof Error ? error : new Error(String(error)),
        { scraperName, sourceName },
      );
      return false;
    }
  }

  /**
   * Create a new scheduled scraper
   */
  async createScraper(
    name: string,
    sources: ScrapingSourceConfig[],
    schedule: ScheduleConfig,
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      this.logger.info(`Creating new scraper: ${name}`, "ScrapingService", {
        sourcesCount: sources.length,
        schedule: schedule.cronExpression,
      });

      // Create scraper engine with sources
      const scraperEngine = new ScraperEngine(
        sources,
        this.logger.createSimpleLogger(`ScraperEngine-${name}`),
        new StatusManager(
          this.logger.createSimpleLogger(`StatusManager-${name}`),
        ),
      );

      // Create scheduled scraper
      const scheduledScraper = new ScheduledScraper(
        scraperEngine,
        schedule,
        this.logger.createSimpleLogger(`ScheduledScraper-${name}`),
      );

      // Add to orchestrator
      await this.orchestrator.addScheduledScraper(name, scheduledScraper);

      this.logger.info(
        `Successfully created scraper: ${name}`,
        "ScrapingService",
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to create scraper: ${name}`,
        "ScrapingService",
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Remove a scheduled scraper
   */
  async removeScraper(name: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      this.logger.info(`Removing scraper: ${name}`, "ScrapingService");

      const success = await this.orchestrator.removeScheduledScraper(name);

      if (success) {
        this.logger.info(
          `Successfully removed scraper: ${name}`,
          "ScrapingService",
        );
      } else {
        this.logger.warn(`Scraper not found: ${name}`, "ScrapingService");
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Failed to remove scraper: ${name}`,
        "ScrapingService",
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Get health status of the scraping service
   */
  getHealth(): OrchestratorHealth {
    this.ensureInitialized();
    return this.orchestrator.getHealth();
  }

  /**
   * Get status of all scrapers
   */
  getScrapersStatus(): Map<
    string,
    {
      isRunning: boolean;
      isScrapingInProgress: boolean;
      lastRunResult: OrchestrationResult | null;
      schedule: ScheduleConfig;
      sourcesCount: number;
    }
  > {
    this.ensureInitialized();
    return this.orchestrator.getScrapersStatus();
  }

  /**
   * Get list of all scraper names
   */
  getScraperNames(): string[] {
    this.ensureInitialized();
    return this.orchestrator.getScraperNames();
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count: number = 100): any[] {
    return this.logger.getRecentLogs(count);
  }

  /**
   * Update logger configuration
   */
  updateLoggerConfig(config: Partial<any>): void {
    this.logger.updateConfig(config);
    this.logger.info("Logger configuration updated", "ScrapingService", {
      config,
    });
  }

  /**
   * Shutdown the scraping service gracefully
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info("Shutting down ScrapingService", "ScrapingService");

      if (this.isInitialized) {
        await this.orchestrator.shutdown();
      }

      await this.logger.shutdown();

      console.log("ScrapingService shutdown complete");
    } catch (error) {
      console.error("Error during ScrapingService shutdown:", error);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "ScrapingService not initialized. Call initialize() first.",
      );
    }
  }

  /**
   * Create a default scraping service configuration
   */
  static createDefaultConfig(): ScrapingServiceConfig {
    return {
      orchestrator: {
        defaultSchedule: {
          cronExpression: "0 */6 * * *", // Every 6 hours
          enabled: true,
          timezone: "Australia/Sydney",
          name: "default-schedule",
        },
        maxConcurrentScrapers: 5,
        retryFailedSources: true,
        retryDelay: 30000, // 30 seconds
        healthCheckInterval: 60000, // 1 minute
      },
      logger: {
        logLevel: LogLevel.INFO,
        logToConsole: true,
        logToFile: true,
        logDirectory: "./logs",
      },
      defaultSources: [
        {
          name: "Sydney Events Example",
          url: "https://example.com/sydney-events",
          selectors: {
            eventContainer: ".event-item",
            title: ".event-title",
            dateTime: ".event-date",
            venueName: ".venue-name",
            venueAddress: ".venue-address",
            description: ".event-description",
            categoryTags: ".event-tags .tag",
            imageUrl: ".event-image img",
            originalEventUrl: ".event-link",
          },
          baseUrl: "https://example.com",
        },
      ],
    };
  }
}

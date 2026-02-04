import {
  ScheduledScraper,
  ScheduleConfig,
  OrchestrationResult,
} from "./ScheduledScraper";
import { ScraperEngine, ScrapingSourceConfig } from "./ScraperEngine";
import { StatusManager } from "./StatusManager";

/**
 * Configuration for the scraper orchestrator
 */
export interface OrchestratorConfig {
  defaultSchedule: ScheduleConfig;
  maxConcurrentScrapers: number;
  retryFailedSources: boolean;
  retryDelay: number; // in milliseconds
  healthCheckInterval: number; // in milliseconds
}

/**
 * Health status of the orchestrator
 */
export interface OrchestratorHealth {
  isHealthy: boolean;
  activeScrapers: number;
  totalScrapers: number;
  lastSuccessfulRun?: Date;
  lastFailedRun?: Date;
  consecutiveFailures: number;
  uptime: number; // in milliseconds
}

/**
 * Orchestrator that manages multiple scheduled scrapers with recovery mechanisms
 */
export class ScraperOrchestrator {
  private scheduledScrapers: Map<string, ScheduledScraper> = new Map();
  private config: OrchestratorConfig;
  private logger: (message: string, level?: "info" | "warn" | "error") => void;
  private startTime: Date;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private consecutiveFailures: number = 0;
  private lastSuccessfulRun?: Date;
  private lastFailedRun?: Date;

  constructor(
    config: OrchestratorConfig,
    logger?: (message: string, level?: "info" | "warn" | "error") => void,
  ) {
    this.config = config;
    this.logger = logger || this.defaultLogger;
    this.startTime = new Date();
  }

  /**
   * Default logger implementation
   */
  private defaultLogger(
    message: string,
    level: "info" | "warn" | "error" = "info",
  ): void {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [ORCHESTRATOR] [${level.toUpperCase()}] ${message}`,
    );
  }

  /**
   * Initialize the orchestrator with default scrapers
   */
  async initialize(): Promise<void> {
    this.logger("Initializing scraper orchestrator", "info");

    try {
      // Create a default scraper for Sydney events
      await this.createDefaultScraper();

      // Start health monitoring
      this.startHealthMonitoring();

      this.logger("Scraper orchestrator initialized successfully", "info");
    } catch (error) {
      this.logger(
        `Failed to initialize orchestrator: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
      throw error;
    }
  }

  /**
   * Create a default scraper for Sydney events
   */
  private async createDefaultScraper(): Promise<void> {
    const defaultSources: ScrapingSourceConfig[] = [
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
    ];

    const scraperEngine = new ScraperEngine(
      defaultSources,
      this.logger,
      new StatusManager(this.logger),
    );

    const scheduledScraper = new ScheduledScraper(
      scraperEngine,
      this.config.defaultSchedule,
      this.logger,
    );

    await this.addScheduledScraper("default", scheduledScraper);
  }

  /**
   * Add a scheduled scraper to the orchestrator
   */
  async addScheduledScraper(
    name: string,
    scheduledScraper: ScheduledScraper,
  ): Promise<void> {
    if (this.scheduledScrapers.has(name)) {
      throw new Error(`Scheduled scraper with name '${name}' already exists`);
    }

    if (this.scheduledScrapers.size >= this.config.maxConcurrentScrapers) {
      throw new Error(
        `Maximum number of concurrent scrapers (${this.config.maxConcurrentScrapers}) reached`,
      );
    }

    this.scheduledScrapers.set(name, scheduledScraper);
    this.logger(`Added scheduled scraper: ${name}`, "info");
  }

  /**
   * Remove a scheduled scraper from the orchestrator
   */
  async removeScheduledScraper(name: string): Promise<boolean> {
    const scraper = this.scheduledScrapers.get(name);
    if (!scraper) {
      return false;
    }

    // Stop the scraper if it's running
    scraper.stop();
    this.scheduledScrapers.delete(name);

    this.logger(`Removed scheduled scraper: ${name}`, "info");
    return true;
  }

  /**
   * Start all scheduled scrapers
   */
  async startAll(): Promise<void> {
    this.logger("Starting all scheduled scrapers", "info");

    const scrapers = Array.from(this.scheduledScrapers.entries());
    const startPromises = scrapers.map(async ([name, scraper]) => {
      try {
        scraper.start();
        this.logger(`Started scraper: ${name}`, "info");
      } catch (error) {
        this.logger(
          `Failed to start scraper ${name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );
      }
    });

    await Promise.allSettled(startPromises);
    this.logger(`Started ${scrapers.length} scrapers`, "info");
  }

  /**
   * Stop all scheduled scrapers
   */
  async stopAll(): Promise<void> {
    this.logger("Stopping all scheduled scrapers", "info");

    const scrapers = Array.from(this.scheduledScrapers.entries());
    scrapers.forEach(([name, scraper]) => {
      try {
        scraper.stop();
        this.logger(`Stopped scraper: ${name}`, "info");
      } catch (error) {
        this.logger(
          `Error stopping scraper ${name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          "warn",
        );
      }
    });

    // Stop health monitoring
    this.stopHealthMonitoring();

    this.logger(`Stopped ${scrapers.length} scrapers`, "info");
  }

  /**
   * Execute manual scraping for all scrapers
   */
  async executeManualScrapingAll(): Promise<Map<string, OrchestrationResult>> {
    this.logger("Executing manual scraping for all scrapers", "info");

    const results = new Map<string, OrchestrationResult>();
    const scrapers = Array.from(this.scheduledScrapers.entries());

    const scrapingPromises = scrapers.map(async ([name, scraper]) => {
      try {
        const result = await scraper.executeManualScraping();
        results.set(name, result);

        if (result.successfulSources > 0) {
          this.lastSuccessfulRun = new Date();
          this.consecutiveFailures = 0;
        } else {
          this.lastFailedRun = new Date();
          this.consecutiveFailures++;
        }

        this.logger(
          `Manual scraping completed for ${name}: ${result.successfulSources}/${result.totalSources} sources successful`,
          "info",
        );
      } catch (error) {
        this.lastFailedRun = new Date();
        this.consecutiveFailures++;

        this.logger(
          `Manual scraping failed for ${name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );
      }
    });

    await Promise.allSettled(scrapingPromises);

    this.logger(
      `Manual scraping completed for ${scrapers.length} scrapers`,
      "info",
    );
    return results;
  }

  /**
   * Execute manual scraping for a specific scraper
   */
  async executeManualScraping(
    scraperName: string,
  ): Promise<OrchestrationResult | null> {
    const scraper = this.scheduledScrapers.get(scraperName);
    if (!scraper) {
      this.logger(`Scraper '${scraperName}' not found`, "warn");
      return null;
    }

    try {
      this.logger(`Executing manual scraping for: ${scraperName}`, "info");
      const result = await scraper.executeManualScraping();

      if (result.successfulSources > 0) {
        this.lastSuccessfulRun = new Date();
        this.consecutiveFailures = 0;
      } else {
        this.lastFailedRun = new Date();
        this.consecutiveFailures++;
      }

      return result;
    } catch (error) {
      this.lastFailedRun = new Date();
      this.consecutiveFailures++;

      this.logger(
        `Manual scraping failed for ${scraperName}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
      return null;
    }
  }

  /**
   * Add a source to a specific scraper
   */
  addSourceToScraper(
    scraperName: string,
    source: ScrapingSourceConfig,
  ): boolean {
    const scraper = this.scheduledScrapers.get(scraperName);
    if (!scraper) {
      this.logger(`Scraper '${scraperName}' not found`, "warn");
      return false;
    }

    scraper.addSource(source);
    this.logger(
      `Added source '${source.name}' to scraper '${scraperName}'`,
      "info",
    );
    return true;
  }

  /**
   * Remove a source from a specific scraper
   */
  removeSourceFromScraper(scraperName: string, sourceName: string): boolean {
    const scraper = this.scheduledScrapers.get(scraperName);
    if (!scraper) {
      this.logger(`Scraper '${scraperName}' not found`, "warn");
      return false;
    }

    const removed = scraper.removeSource(sourceName);
    if (removed) {
      this.logger(
        `Removed source '${sourceName}' from scraper '${scraperName}'`,
        "info",
      );
    }
    return removed;
  }

  /**
   * Get health status of the orchestrator
   */
  getHealth(): OrchestratorHealth {
    const activeScrapers = Array.from(this.scheduledScrapers.values()).filter(
      (scraper) => scraper.isSchedulerRunning(),
    ).length;

    const uptime = new Date().getTime() - this.startTime.getTime();

    return {
      isHealthy: this.consecutiveFailures < 5 && activeScrapers > 0,
      activeScrapers,
      totalScrapers: this.scheduledScrapers.size,
      lastSuccessfulRun: this.lastSuccessfulRun,
      lastFailedRun: this.lastFailedRun,
      consecutiveFailures: this.consecutiveFailures,
      uptime,
    };
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
    const status = new Map();

    this.scheduledScrapers.forEach((scraper, name) => {
      status.set(name, {
        isRunning: scraper.isSchedulerRunning(),
        isScrapingInProgress: scraper.isScrapingInProgress(),
        lastRunResult: scraper.getLastRunResult(),
        schedule: scraper.getSchedule(),
        sourcesCount: scraper.getSources().length,
      });
    });

    return status;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.logger("Health monitoring started", "info");
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.logger("Health monitoring stopped", "info");
    }
  }

  /**
   * Perform health check and recovery if needed
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = this.getHealth();

      if (!health.isHealthy) {
        this.logger(
          `Health check failed: ${health.consecutiveFailures} consecutive failures, ${health.activeScrapers}/${health.totalScrapers} scrapers active`,
          "warn",
        );

        // Attempt recovery if configured
        if (this.config.retryFailedSources && health.consecutiveFailures >= 3) {
          await this.attemptRecovery();
        }
      } else {
        // Log health status periodically (every 10 checks)
        if (Math.random() < 0.1) {
          this.logger(
            `Health check passed: ${health.activeScrapers}/${health.totalScrapers} scrapers active, uptime: ${Math.round(health.uptime / 60000)}min`,
            "info",
          );
        }
      }
    } catch (error) {
      this.logger(
        `Health check error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  }

  /**
   * Attempt recovery by restarting failed scrapers
   */
  private async attemptRecovery(): Promise<void> {
    this.logger("Attempting recovery of failed scrapers", "warn");

    const scrapers = Array.from(this.scheduledScrapers.entries());

    for (const [name, scraper] of scrapers) {
      if (!scraper.isSchedulerRunning()) {
        try {
          this.logger(`Attempting to restart scraper: ${name}`, "info");

          // Wait for retry delay
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelay),
          );

          scraper.start();
          this.logger(`Successfully restarted scraper: ${name}`, "info");
        } catch (error) {
          this.logger(
            `Failed to restart scraper ${name}: ${error instanceof Error ? error.message : "Unknown error"}`,
            "error",
          );
        }
      }
    }
  }

  /**
   * Get orchestrator configuration
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Update orchestrator configuration
   */
  updateConfig(newConfig: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart health monitoring if interval changed
    if (newConfig.healthCheckInterval) {
      this.stopHealthMonitoring();
      this.startHealthMonitoring();
    }

    this.logger("Orchestrator configuration updated", "info");
  }

  /**
   * Get list of all scraper names
   */
  getScraperNames(): string[] {
    return Array.from(this.scheduledScrapers.keys());
  }

  /**
   * Get a specific scraper by name
   */
  getScraper(name: string): ScheduledScraper | undefined {
    return this.scheduledScrapers.get(name);
  }

  /**
   * Shutdown the orchestrator gracefully
   */
  async shutdown(): Promise<void> {
    this.logger("Shutting down scraper orchestrator", "info");

    await this.stopAll();
    this.stopHealthMonitoring();

    this.logger("Scraper orchestrator shutdown complete", "info");
  }
}

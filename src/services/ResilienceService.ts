import { Event } from "../models/Event";
import { ScrapingLog } from "../models/ScrapingLog";
import {
  SystemDegradationManager,
  DegradationLevel,
  GlobalErrorCategory,
  createEnhancedError,
} from "../middleware/globalErrorHandler";
import { ServiceCircuitBreaker } from "../middleware/errorHandler";

/**
 * Service for managing system resilience and graceful degradation
 */
export class ResilienceService {
  private static instance: ResilienceService;
  private degradationManager: SystemDegradationManager;
  private scraperCircuitBreaker: ServiceCircuitBreaker;
  private lastSuccessfulScrape: Date | null = null;
  private cachedEvents: any[] = [];
  private cacheExpiry: Date | null = null;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.degradationManager = SystemDegradationManager.getInstance();
    this.scraperCircuitBreaker = ServiceCircuitBreaker.getInstance("scraper");
    this.initializeCache();
  }

  static getInstance(): ResilienceService {
    if (!ResilienceService.instance) {
      ResilienceService.instance = new ResilienceService();
    }
    return ResilienceService.instance;
  }

  /**
   * Initialize event cache for fallback scenarios
   */
  private async initializeCache(): Promise<void> {
    try {
      // Load recent events into cache
      const recentEvents = await Event.find({ status: "imported" })
        .sort({ dateTime: 1 })
        .limit(100)
        .lean();

      this.cachedEvents = recentEvents;
      this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION);

      console.log(`Initialized event cache with ${recentEvents.length} events`);
    } catch (error) {
      console.error("Failed to initialize event cache:", error);
    }
  }

  /**
   * Check scraper health and update system status
   */
  async checkScraperHealth(): Promise<boolean> {
    try {
      // Check recent scraping logs
      const recentLogs = await ScrapingLog.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const recentSuccessful = recentLogs.filter(
        (log) => log.status === "completed",
      );
      const recentFailed = recentLogs.filter((log) => log.status === "failed");

      // Update last successful scrape time
      if (recentSuccessful.length > 0) {
        this.lastSuccessfulScrape = recentSuccessful[0].createdAt;
      }

      // Determine scraper health
      const isHealthy = recentSuccessful.length > 0 && recentFailed.length < 3;

      if (!isHealthy) {
        this.degradationManager.reportServiceDegradation(
          "scraper",
          DegradationLevel.MINOR,
        );
        console.warn("Scraper health check failed - service degraded");
      } else {
        this.degradationManager.reportServiceRecovery("scraper");
      }

      return isHealthy;
    } catch (error) {
      console.error("Scraper health check failed:", error);
      this.degradationManager.reportServiceDegradation(
        "scraper",
        DegradationLevel.MODERATE,
      );
      return false;
    }
  }

  /**
   * Get events with fallback to cached data during scraper failures
   */
  async getEventsWithFallback(filters: any = {}): Promise<{
    events: any[];
    fromCache: boolean;
    degradationInfo?: any;
  }> {
    const systemStatus = this.degradationManager.getSystemStatus();

    try {
      // Try to get fresh events from database
      const events = await Event.find({
        status: "imported",
        dateTime: { $gte: new Date() }, // Only future events
        ...filters,
      })
        .sort({ dateTime: 1 })
        .limit(50)
        .lean();

      // Update cache with fresh data
      if (events.length > 0) {
        this.cachedEvents = events;
        this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION);
      }

      return {
        events,
        fromCache: false,
        ...(systemStatus.degradationLevel !== DegradationLevel.NONE && {
          degradationInfo: {
            level: systemStatus.degradationLevel,
            degradedServices: systemStatus.degradedServices,
            message:
              "Some services are experiencing issues, but event data is current",
          },
        }),
      };
    } catch (error) {
      console.error(
        "Failed to fetch events from database, falling back to cache:",
        error,
      );

      // Fall back to cached events
      const isCacheValid = this.cacheExpiry && new Date() < this.cacheExpiry;

      if (isCacheValid && this.cachedEvents.length > 0) {
        return {
          events: this.cachedEvents.filter((event) => {
            const eventDate = new Date(event.dateTime);
            return eventDate >= new Date(); // Only future events
          }),
          fromCache: true,
          degradationInfo: {
            level: DegradationLevel.MODERATE,
            message:
              "Showing cached event data due to temporary service issues",
            cacheAge: Math.floor(
              (Date.now() -
                (this.cacheExpiry!.getTime() - this.CACHE_DURATION)) /
                1000 /
                60,
            ),
            lastUpdate: this.lastSuccessfulScrape,
          },
        };
      }

      // No cache available - return empty with error info
      throw createEnhancedError(
        "Event data temporarily unavailable",
        GlobalErrorCategory.SCRAPER,
        503,
        { systemStatus },
        [
          "Please try again in a few minutes",
          "Check our status page for updates",
        ],
      );
    }
  }

  /**
   * Execute scraper operation with circuit breaker protection
   */
  async executeScraperOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    try {
      return await this.scraperCircuitBreaker.execute(async () => {
        console.log(`Executing scraper operation: ${operationName}`);
        const result = await operation();

        // Report successful operation
        this.degradationManager.reportServiceRecovery("scraper");

        return result;
      });
    } catch (error) {
      console.error(`Scraper operation failed: ${operationName}`, error);

      // Report scraper degradation
      this.degradationManager.reportServiceDegradation(
        "scraper",
        DegradationLevel.MINOR,
      );

      throw createEnhancedError(
        `Scraper operation failed: ${operationName}`,
        GlobalErrorCategory.SCRAPER,
        503,
        {
          operationName,
          error: error instanceof Error ? error.message : String(error),
        },
        [
          "The scraping service is temporarily unavailable",
          "Existing event data remains accessible",
          "New events will be updated once service recovers",
        ],
      );
    }
  }

  /**
   * Get system resilience status
   */
  getResilienceStatus() {
    const systemStatus = this.degradationManager.getSystemStatus();
    const scraperStatus = this.scraperCircuitBreaker.getStatus();

    return {
      systemHealth: systemStatus,
      scraperHealth: scraperStatus,
      cacheStatus: {
        hasCache: this.cachedEvents.length > 0,
        cacheSize: this.cachedEvents.length,
        cacheExpiry: this.cacheExpiry,
        isValid: this.cacheExpiry && new Date() < this.cacheExpiry,
      },
      lastSuccessfulScrape: this.lastSuccessfulScrape,
      recommendations: this.getHealthRecommendations(
        systemStatus,
        scraperStatus,
      ),
    };
  }

  /**
   * Get health recommendations based on current status
   */
  private getHealthRecommendations(
    systemStatus: any,
    scraperStatus: any,
  ): string[] {
    const recommendations: string[] = [];

    if (systemStatus.degradationLevel === DegradationLevel.SEVERE) {
      recommendations.push("System is experiencing significant issues");
      recommendations.push("Some features may be temporarily unavailable");
    } else if (systemStatus.degradationLevel === DegradationLevel.MODERATE) {
      recommendations.push("System is running with reduced functionality");
      recommendations.push("Event data may be slightly delayed");
    } else if (systemStatus.degradationLevel === DegradationLevel.MINOR) {
      recommendations.push("Minor service issues detected");
      recommendations.push("All core features remain available");
    }

    if (!scraperStatus.isHealthy) {
      recommendations.push("Event scraping service is experiencing issues");
      recommendations.push("Existing events remain accessible");
      recommendations.push("New event updates may be delayed");
    }

    if (recommendations.length === 0) {
      recommendations.push("All systems operating normally");
    }

    return recommendations;
  }

  /**
   * Refresh event cache manually
   */
  async refreshCache(): Promise<void> {
    await this.initializeCache();
  }

  /**
   * Clear degradation status (for testing/admin purposes)
   */
  clearDegradationStatus(): void {
    this.degradationManager.reportServiceRecovery("scraper");
    this.degradationManager.reportServiceRecovery("database");
    this.degradationManager.reportServiceRecovery("external");
  }
}

export default ResilienceService;

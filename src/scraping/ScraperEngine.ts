import * as cheerio from "cheerio";
import axios from "axios";
import { EventData, ScrapingResult, ScrapingError } from "../types";
import { StatusManager, ChangeDetectionResult } from "./StatusManager";
import { CircuitBreakerManager } from "../utils/CircuitBreaker";
import { ErrorHandler, CategorizedScrapingError } from "./ErrorHandler";

/**
 * Enhanced scraping result that includes status management information
 */
export interface EnhancedScrapingResult extends ScrapingResult {
  changeDetection?: ChangeDetectionResult;
}

/**
 * Configuration for a scraping source
 */
export interface ScrapingSourceConfig {
  name: string;
  url: string;
  selectors: {
    eventContainer: string;
    title: string;
    dateTime: string;
    venueName: string;
    venueAddress?: string;
    description: string;
    categoryTags?: string;
    imageUrl?: string;
    originalEventUrl: string;
  };
  dateFormat?: string;
  baseUrl?: string;
}

/**
 * Main scraping engine that orchestrates the scraping workflow
 */
export class ScraperEngine {
  private sources: ScrapingSourceConfig[];
  private logger: (message: string, level?: "info" | "warn" | "error") => void;
  private statusManager: StatusManager;
  private circuitBreakerManager: CircuitBreakerManager;
  private resilientMode: boolean = true; // Enable resilient mode by default

  constructor(
    sources: ScrapingSourceConfig[] = [],
    logger?: (message: string, level?: "info" | "warn" | "error") => void,
    statusManager?: StatusManager,
    resilientMode: boolean = true,
  ) {
    this.sources = sources;
    this.logger = logger || this.defaultLogger;
    this.statusManager = statusManager || new StatusManager(this.logger);
    this.circuitBreakerManager = CircuitBreakerManager.getInstance();
    this.resilientMode = resilientMode;
  }

  /**
   * Default logger implementation
   */
  private defaultLogger(
    message: string,
    level: "info" | "warn" | "error" = "info",
  ): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }

  /**
   * Add a scraping source configuration
   */
  addSource(source: ScrapingSourceConfig): void {
    this.sources.push(source);
    this.logger(`Added scraping source: ${source.name}`, "info");
  }

  /**
   * Scrape all configured sources with enhanced resilience
   */
  async scrapeAllResilient(): Promise<EnhancedScrapingResult[]> {
    const results: EnhancedScrapingResult[] = [];
    const errors: CategorizedScrapingError[] = [];

    this.logger(
      `Starting resilient scraping for ${this.sources.length} sources`,
      "info",
    );

    // Process sources with error isolation
    for (const source of this.sources) {
      try {
        const result = await this.scrapeSourceResilient(source);
        results.push(result);

        if (result.events.length > 0) {
          this.logger(
            `✓ Completed scraping ${source.name}: ${result.events.length} events found`,
            "info",
          );
        } else {
          this.logger(
            `⚠ Completed scraping ${source.name}: No events found`,
            "warn",
          );
        }
      } catch (error) {
        const categorizedError = ErrorHandler.categorizeError(
          error,
          source.url,
        );
        errors.push(categorizedError);

        ErrorHandler.logError(categorizedError, this.logger);

        // Create failed result but continue processing other sources
        const failedResult: EnhancedScrapingResult = {
          events: [],
          scrapingErrors: [categorizedError],
          sourceUrl: source.url,
          scrapedAt: new Date(),
        };

        results.push(failedResult);
      }
    }

    // Analyze errors and determine if scraping should continue
    if (errors.length > 0) {
      const shouldContinue = ErrorHandler.shouldContinueScraping(errors);
      const errorSummary = ErrorHandler.createErrorSummary(errors);

      this.logger(
        `Scraping completed with ${errors.length} errors. ` +
          `High severity: ${errorSummary.bySeverity.high}, ` +
          `Should continue: ${shouldContinue}`,
        shouldContinue ? "warn" : "error",
      );

      if (!shouldContinue && this.resilientMode) {
        this.logger(
          "Too many critical errors, enabling degraded mode",
          "error",
        );
      }
    }

    this.logger(
      `Resilient scraping completed. ` +
        `Successful sources: ${results.filter((r) => r.events.length > 0).length}/${this.sources.length}`,
      "info",
    );

    return results;
  }

  /**
   * Scrape a single source with circuit breaker protection
   */
  private async scrapeSourceResilient(
    source: ScrapingSourceConfig,
  ): Promise<EnhancedScrapingResult> {
    const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(
      `scraper-${source.name}`,
      {
        failureThreshold: 3,
        recoveryTimeout: 300000, // 5 minutes
        monitoringPeriod: 900000, // 15 minutes
        successThreshold: 2,
      },
    );

    return await circuitBreaker.execute(async () => {
      return await ErrorHandler.withRetry(
        async () => await this.scrapeSourceWithStatusManagement(source),
        2, // Max 2 retries
        [2000, 5000], // 2s, 5s delays
      );
    });
  }

  /**
   * Scrape all configured sources
   */
  async scrapeAll(): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    this.logger(`Starting scraping for ${this.sources.length} sources`, "info");

    for (const source of this.sources) {
      try {
        const result = await this.scrapeSource(source);
        results.push(result);
        this.logger(
          `Completed scraping ${source.name}: ${result.events.length} events found`,
          "info",
        );
      } catch (error) {
        const scrapingError: ScrapingError = {
          message: `Failed to scrape source ${source.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          url: source.url,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date(),
        };

        const failedResult: ScrapingResult = {
          events: [],
          scrapingErrors: [scrapingError],
          sourceUrl: source.url,
          scrapedAt: new Date(),
        };

        results.push(failedResult);
        this.logger(
          `Error scraping ${source.name}: ${scrapingError.message}`,
          "error",
        );
      }
    }

    this.logger(`Scraping completed. Total results: ${results.length}`, "info");
    return results;
  }

  /**
   * Scrape a single source with status management
   */
  async scrapeSourceWithStatusManagement(
    source: ScrapingSourceConfig,
  ): Promise<EnhancedScrapingResult> {
    const basicResult = await this.scrapeSource(source);

    // If scraping was successful, process events through status manager
    if (basicResult.events.length > 0) {
      try {
        const changeDetection = await this.statusManager.processScrapedEvents(
          basicResult.events,
          source.name,
        );

        return {
          ...basicResult,
          changeDetection,
        };
      } catch (error) {
        this.logger(
          `Error processing status changes for ${source.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );

        // Return basic result without change detection if status processing fails
        return basicResult;
      }
    }

    return basicResult;
  }

  /**
   * Scrape a single source
   */
  async scrapeSource(source: ScrapingSourceConfig): Promise<ScrapingResult> {
    const scrapedAt = new Date();
    const scrapingErrors: ScrapingError[] = [];

    try {
      this.logger(`Fetching content from ${source.url}`, "info");

      // Fetch HTML content
      const response = await axios.get(source.url, {
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Extract events from HTML
      const events = this.extractEvents($, source, scrapingErrors);

      return {
        events,
        scrapingErrors,
        sourceUrl: source.url,
        scrapedAt,
      };
    } catch (error) {
      const scrapingError: ScrapingError = {
        message: `Network error fetching ${source.url}: ${error instanceof Error ? error.message : "Unknown error"}`,
        url: source.url,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date(),
      };

      return {
        events: [],
        scrapingErrors: [scrapingError],
        sourceUrl: source.url,
        scrapedAt,
      };
    }
  }

  /**
   * Extract events from HTML using cheerio
   */
  private extractEvents(
    $: cheerio.Root,
    source: ScrapingSourceConfig,
    scrapingErrors: ScrapingError[],
  ): EventData[] {
    const events: EventData[] = [];
    const eventElements = $(source.selectors.eventContainer);

    this.logger(
      `Found ${eventElements.length} potential events in ${source.name}`,
      "info",
    );

    eventElements.each((index, element) => {
      try {
        const eventData = this.extractSingleEvent($, element, source);
        if (eventData) {
          events.push(eventData);
        }
      } catch (error) {
        const scrapingError: ScrapingError = {
          message: `Error extracting event ${index + 1} from ${source.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          url: source.url,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date(),
        };
        scrapingErrors.push(scrapingError);
        this.logger(
          `Error extracting event ${index + 1}: ${scrapingError.message}`,
          "warn",
        );
      }
    });

    return events;
  }

  /**
   * Extract a single event from an HTML element
   */
  private extractSingleEvent(
    $: cheerio.Root,
    element: cheerio.Element,
    source: ScrapingSourceConfig,
  ): EventData | null {
    const $element = $(element);

    // Extract required fields
    const title = this.extractText($element, source.selectors.title);
    const dateTimeStr = this.extractText($element, source.selectors.dateTime);
    const venueName = this.extractText($element, source.selectors.venueName);
    const description = this.extractText(
      $element,
      source.selectors.description,
    );
    const originalEventUrl = this.extractUrl(
      $element,
      source.selectors.originalEventUrl,
      source.baseUrl,
    );

    // Validate required fields
    if (
      !title ||
      !dateTimeStr ||
      !venueName ||
      !description ||
      !originalEventUrl
    ) {
      throw new Error(
        `Missing required fields: title=${!!title}, dateTime=${!!dateTimeStr}, venueName=${!!venueName}, description=${!!description}, originalEventUrl=${!!originalEventUrl}`,
      );
    }

    // Parse date
    const dateTime = this.parseDateTime(dateTimeStr, source.dateFormat);
    if (!dateTime) {
      throw new Error(`Invalid date format: ${dateTimeStr}`);
    }

    // Extract optional fields
    const venueAddress = source.selectors.venueAddress
      ? this.extractText($element, source.selectors.venueAddress)
      : undefined;

    const categoryTags = source.selectors.categoryTags
      ? this.extractTags($element, source.selectors.categoryTags)
      : [];

    const imageUrl = source.selectors.imageUrl
      ? this.extractUrl($element, source.selectors.imageUrl, source.baseUrl)
      : undefined;

    // Create normalized event data
    const eventData: EventData = {
      title: title.trim(),
      dateTime,
      venueName: venueName.trim(),
      venueAddress: venueAddress?.trim(),
      city: "Sydney", // Default to Sydney as per requirement 1.2
      description: description.trim(),
      categoryTags,
      imageUrl,
      sourceWebsite: source.name,
      originalEventUrl,
      lastScrapedAt: new Date(),
    };

    return this.validateEventData(eventData) ? eventData : null;
  }

  /**
   * Extract text content from an element using a selector
   */
  private extractText($element: any, selector: string): string {
    const element = $element.find(selector).first();
    if (element.length === 0) {
      return $element.is(selector) ? $element.text() : "";
    }
    return element.text();
  }

  /**
   * Extract URL from an element using a selector
   */
  private extractUrl(
    $element: any,
    selector: string,
    baseUrl?: string,
  ): string {
    const element = $element.find(selector).first();
    let url = "";

    if (element.length === 0) {
      // Check if the element itself matches the selector
      if ($element.is(selector)) {
        url = $element.attr("href") || $element.attr("src") || "";
      }
    } else {
      url = element.attr("href") || element.attr("src") || "";
    }

    // Convert relative URLs to absolute URLs
    if (url && baseUrl && !url.startsWith("http")) {
      if (url.startsWith("/")) {
        url = baseUrl + url;
      } else {
        url = baseUrl + "/" + url;
      }
    }

    return url;
  }

  /**
   * Extract category tags from an element
   */
  private extractTags($element: any, selector: string): string[] {
    const elements = $element.find(selector);
    const tags: string[] = [];

    elements.each((_: number, el: any) => {
      const $el = cheerio.load(el);
      const tag = $el.root().text().trim();
      if (tag) {
        tags.push(tag);
      }
    });

    return tags;
  }

  /**
   * Parse date string into Date object
   */
  private parseDateTime(dateStr: string, format?: string): Date | null {
    try {
      // Clean up the date string
      const cleanDateStr = dateStr.trim().replace(/\s+/g, " ");

      // Try parsing as ISO date first
      const isoDate = new Date(cleanDateStr);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }

      // Try common date formats
      const commonFormats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i, // MM/DD/YYYY HH:MM AM/PM
        /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/, // YYYY-MM-DD HH:MM
        /(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i, // DD Month YYYY HH:MM
      ];

      for (const regex of commonFormats) {
        const match = cleanDateStr.match(regex);
        if (match) {
          // This is a simplified parser - in production, you'd want a more robust date parsing library
          const parsedDate = new Date(cleanDateStr);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate event data completeness and correctness
   */
  private validateEventData(eventData: EventData): boolean {
    try {
      // Check required fields
      if (!eventData.title || eventData.title.trim().length === 0) return false;
      if (!eventData.dateTime || isNaN(eventData.dateTime.getTime()))
        return false;
      if (!eventData.venueName || eventData.venueName.trim().length === 0)
        return false;
      if (!eventData.description || eventData.description.trim().length === 0)
        return false;
      if (
        !eventData.sourceWebsite ||
        eventData.sourceWebsite.trim().length === 0
      )
        return false;
      if (
        !eventData.originalEventUrl ||
        eventData.originalEventUrl.trim().length === 0
      )
        return false;
      if (!eventData.city || eventData.city.trim().length === 0) return false;

      // Validate URL format
      try {
        new URL(eventData.originalEventUrl);
      } catch {
        return false;
      }

      // Validate date is not in the past (with some tolerance)
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (eventData.dateTime < oneDayAgo) {
        return false;
      }

      // Validate arrays
      if (!Array.isArray(eventData.categoryTags)) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get configured sources
   */
  getSources(): ScrapingSourceConfig[] {
    return [...this.sources];
  }

  /**
   * Get the status manager instance
   */
  getStatusManager(): StatusManager {
    return this.statusManager;
  }

  /**
   * Remove a source by name
   */
  removeSource(name: string): boolean {
    const initialLength = this.sources.length;
    this.sources = this.sources.filter((source) => source.name !== name);
    const removed = this.sources.length < initialLength;

    if (removed) {
      this.logger(`Removed scraping source: ${name}`, "info");
    }

    return removed;
  }

  /**
   * Get circuit breaker health status for all sources
   */
  getCircuitBreakerHealth(): {
    overallHealthy: boolean;
    circuitBreakers: Array<
      ReturnType<import("../utils/CircuitBreaker").CircuitBreaker["getStatus"]>
    >;
    summary: ReturnType<
      import("../utils/CircuitBreaker").CircuitBreakerManager["getHealthSummary"]
    >;
  } {
    const summary = this.circuitBreakerManager.getHealthSummary();
    const circuitBreakers = this.circuitBreakerManager.getAllStatuses();

    return {
      overallHealthy: summary.overallHealthy,
      circuitBreakers,
      summary,
    };
  }

  /**
   * Reset all circuit breakers for this scraper
   */
  resetCircuitBreakers(): void {
    this.sources.forEach((source) => {
      const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(
        `scraper-${source.name}`,
      );
      circuitBreaker.reset();
    });
    this.logger("All circuit breakers reset", "info");
  }

  /**
   * Enable or disable resilient mode
   */
  setResilientMode(enabled: boolean): void {
    this.resilientMode = enabled;
    this.logger(`Resilient mode ${enabled ? "enabled" : "disabled"}`, "info");
  }

  /**
   * Get resilient mode status
   */
  isResilientMode(): boolean {
    return this.resilientMode;
  }
}

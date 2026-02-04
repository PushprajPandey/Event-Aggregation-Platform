import * as cron from "node-cron";
import { ScraperEngine, ScrapingSourceConfig } from "./ScraperEngine";
import { ScrapingLog } from "../models/ScrapingLog";
import { IScrapingLog } from "../types";

/**
 * Configuration for scheduled scraping
 */
export interface ScheduleConfig {
  cronExpression: string;
  enabled: boolean;
  timezone?: string;
  name?: string;
}

/**
 * Orchestration result for a complete scraping cycle
 */
export interface OrchestrationResult {
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  totalEvents: number;
  totalErrors: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  sourceResults: Array<{
    sourceName: string;
    success: boolean;
    eventsFound: number;
    errors: number;
    duration: number;
  }>;
}

/**
 * Scheduled scraper that orchestrates multiple sources with error isolation
 */
export class ScheduledScraper {
  private scraperEngine: ScraperEngine;
  private schedule: ScheduleConfig;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private logger: (message: string, level?: "info" | "warn" | "error") => void;
  private lastRunResult: OrchestrationResult | null = null;

  constructor(
    scraperEngine: ScraperEngine,
    schedule: ScheduleConfig,
    logger?: (message: string, level?: "info" | "warn" | "error") => void,
  ) {
    this.scraperEngine = scraperEngine;
    this.schedule = schedule;
    this.logger = logger || this.defaultLogger;
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
      `[${timestamp}] [SCHEDULER] [${level.toUpperCase()}] ${message}`,
    );
  }

  /**
   * Start the scheduled scraping
   */
  start(): void {
    if (this.cronJob) {
      this.logger("Scheduled scraper is already running", "warn");
      return;
    }

    if (!this.schedule.enabled) {
      this.logger("Scheduled scraper is disabled", "info");
      return;
    }

    try {
      this.cronJob = cron.schedule(
        this.schedule.cronExpression,
        async () => {
          await this.executeScrapingCycle();
        },
        {
          scheduled: true,
          timezone: this.schedule.timezone || "Australia/Sydney",
        },
      );

      this.logger(
        `Scheduled scraper started with cron expression: ${this.schedule.cronExpression}`,
        "info",
      );
    } catch (error) {
      this.logger(
        `Failed to start scheduled scraper: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
      throw error;
    }
  }

  /**
   * Stop the scheduled scraping
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger("Scheduled scraper stopped", "info");
    } else {
      this.logger("Scheduled scraper is not running", "warn");
    }
  }

  /**
   * Execute a complete scraping cycle with orchestration
   */
  async executeScrapingCycle(): Promise<OrchestrationResult> {
    if (this.isRunning) {
      this.logger("Scraping cycle already in progress, skipping", "warn");
      return this.lastRunResult || this.createEmptyResult();
    }

    this.isRunning = true;
    const startTime = new Date();

    this.logger("Starting scheduled scraping cycle", "info");

    try {
      const result = await this.orchestrateScrapingSources();
      this.lastRunResult = result;

      this.logger(
        `Scraping cycle completed: ${result.successfulSources}/${result.totalSources} sources successful, ${result.totalEvents} events found, ${result.totalErrors} errors, duration: ${Math.round(result.duration / 1000)}s`,
        "info",
      );

      return result;
    } catch (error) {
      this.logger(
        `Scraping cycle failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );

      const endTime = new Date();
      const failedResult: OrchestrationResult = {
        totalSources: this.scraperEngine.getSources().length,
        successfulSources: 0,
        failedSources: this.scraperEngine.getSources().length,
        totalEvents: 0,
        totalErrors: 1,
        duration: endTime.getTime() - startTime.getTime(),
        startTime,
        endTime,
        sourceResults: [],
      };

      this.lastRunResult = failedResult;
      return failedResult;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Orchestrate scraping across multiple sources with error isolation
   */
  private async orchestrateScrapingSources(): Promise<OrchestrationResult> {
    const startTime = new Date();
    const sources = this.scraperEngine.getSources();

    if (sources.length === 0) {
      this.logger("No scraping sources configured", "warn");
      return this.createEmptyResult();
    }

    this.logger(`Orchestrating scraping for ${sources.length} sources`, "info");

    const sourceResults: OrchestrationResult["sourceResults"] = [];
    let totalEvents = 0;
    let totalErrors = 0;
    let successfulSources = 0;

    // Process each source with error isolation
    for (const source of sources) {
      const sourceStartTime = new Date();
      let scrapingLog: IScrapingLog | null = null;

      try {
        // Create scraping log entry
        scrapingLog = await ScrapingLog.createLog(source.url);

        this.logger(`Starting scraping for source: ${source.name}`, "info");

        // Scrape the source with status management
        const result =
          await this.scraperEngine.scrapeSourceWithStatusManagement(source);

        const sourceEndTime = new Date();
        const sourceDuration =
          sourceEndTime.getTime() - sourceStartTime.getTime();

        // Update scraping log with results
        await scrapingLog.markCompleted(
          result.events.length,
          result.events.length,
        );

        // Log any scraping errors
        if (result.scrapingErrors.length > 0) {
          for (const error of result.scrapingErrors) {
            await scrapingLog.addError(error.message);
            this.logger(
              `Scraping error in ${source.name}: ${error.message}`,
              "warn",
            );
          }
        }

        // Record source result
        sourceResults.push({
          sourceName: source.name,
          success: true,
          eventsFound: result.events.length,
          errors: result.scrapingErrors.length,
          duration: sourceDuration,
        });

        totalEvents += result.events.length;
        totalErrors += result.scrapingErrors.length;
        successfulSources++;

        this.logger(
          `Completed scraping ${source.name}: ${result.events.length} events, ${result.scrapingErrors.length} errors, ${Math.round(sourceDuration / 1000)}s`,
          "info",
        );
      } catch (error) {
        const sourceEndTime = new Date();
        const sourceDuration =
          sourceEndTime.getTime() - sourceStartTime.getTime();
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Update scraping log with failure
        if (scrapingLog) {
          await scrapingLog.markFailed(errorMessage);
        }

        // Record failed source result
        sourceResults.push({
          sourceName: source.name,
          success: false,
          eventsFound: 0,
          errors: 1,
          duration: sourceDuration,
        });

        totalErrors++;

        this.logger(
          `Failed to scrape ${source.name}: ${errorMessage}`,
          "error",
        );

        // Continue with next source (error isolation)
        continue;
      }
    }

    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();

    return {
      totalSources: sources.length,
      successfulSources,
      failedSources: sources.length - successfulSources,
      totalEvents,
      totalErrors,
      duration: totalDuration,
      startTime,
      endTime,
      sourceResults,
    };
  }

  /**
   * Create an empty orchestration result
   */
  private createEmptyResult(): OrchestrationResult {
    const now = new Date();
    return {
      totalSources: 0,
      successfulSources: 0,
      failedSources: 0,
      totalEvents: 0,
      totalErrors: 0,
      duration: 0,
      startTime: now,
      endTime: now,
      sourceResults: [],
    };
  }

  /**
   * Get the current schedule configuration
   */
  getSchedule(): ScheduleConfig {
    return { ...this.schedule };
  }

  /**
   * Update the schedule configuration
   */
  updateSchedule(newSchedule: Partial<ScheduleConfig>): void {
    const wasRunning = this.cronJob !== null;

    if (wasRunning) {
      this.stop();
    }

    this.schedule = { ...this.schedule, ...newSchedule };

    if (wasRunning && this.schedule.enabled) {
      this.start();
    }

    this.logger("Schedule configuration updated", "info");
  }

  /**
   * Check if the scheduler is currently running
   */
  isSchedulerRunning(): boolean {
    return this.cronJob !== null;
  }

  /**
   * Check if a scraping cycle is currently in progress
   */
  isScrapingInProgress(): boolean {
    return this.isRunning;
  }

  /**
   * Get the result of the last scraping cycle
   */
  getLastRunResult(): OrchestrationResult | null {
    return this.lastRunResult;
  }

  /**
   * Execute a manual scraping cycle (outside of schedule)
   */
  async executeManualScraping(): Promise<OrchestrationResult> {
    this.logger("Executing manual scraping cycle", "info");
    return await this.executeScrapingCycle();
  }

  /**
   * Add a new scraping source to the engine
   */
  addSource(source: ScrapingSourceConfig): void {
    this.scraperEngine.addSource(source);
    this.logger(`Added scraping source to scheduler: ${source.name}`, "info");
  }

  /**
   * Remove a scraping source from the engine
   */
  removeSource(sourceName: string): boolean {
    const removed = this.scraperEngine.removeSource(sourceName);
    if (removed) {
      this.logger(
        `Removed scraping source from scheduler: ${sourceName}`,
        "info",
      );
    }
    return removed;
  }

  /**
   * Get all configured sources
   */
  getSources(): ScrapingSourceConfig[] {
    return this.scraperEngine.getSources();
  }

  /**
   * Get scraping statistics for monitoring
   */
  async getScrapingStats(days: number = 7): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    avgEventsPerRun: number;
    avgDuration: number;
    lastRun?: Date;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const logs = await ScrapingLog.find({
        startTime: { $gte: cutoffDate },
        status: { $in: ["completed", "failed"] },
      }).sort({ startTime: -1 });

      if (logs.length === 0) {
        return {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          avgEventsPerRun: 0,
          avgDuration: 0,
        };
      }

      const totalRuns = logs.length;
      const successfulRuns = logs.filter(
        (log) => log.status === "completed",
      ).length;
      const failedRuns = totalRuns - successfulRuns;

      const totalEvents = logs.reduce((sum, log) => sum + log.eventsFound, 0);
      const avgEventsPerRun = totalEvents / totalRuns;

      const completedLogs = logs.filter((log) => log.endTime);
      const totalDuration = completedLogs.reduce((sum, log) => {
        return sum + (log.endTime!.getTime() - log.startTime.getTime());
      }, 0);
      const avgDuration =
        completedLogs.length > 0 ? totalDuration / completedLogs.length : 0;

      return {
        totalRuns,
        successfulRuns,
        failedRuns,
        avgEventsPerRun: Math.round(avgEventsPerRun * 100) / 100,
        avgDuration: Math.round(avgDuration / 1000), // Convert to seconds
        lastRun: logs[0]?.startTime,
      };
    } catch (error) {
      this.logger(
        `Error getting scraping stats: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
      return {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        avgEventsPerRun: 0,
        avgDuration: 0,
      };
    }
  }

  /**
   * Validate cron expression
   */
  static validateCronExpression(expression: string): boolean {
    return cron.validate(expression);
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime(): Date | null {
    if (!this.cronJob) {
      return null;
    }

    try {
      // This is a simplified implementation - in production you might want to use a more robust cron parser
      return new Date(Date.now() + 60000); // Placeholder - returns 1 minute from now
    } catch (error) {
      this.logger(
        `Error calculating next run time: ${error instanceof Error ? error.message : "Unknown error"}`,
        "warn",
      );
      return null;
    }
  }
}

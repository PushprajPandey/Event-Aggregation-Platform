import { ScrapingError } from "../types";

/**
 * Error categories for scraping operations
 */
export enum ErrorCategory {
  NETWORK = "network",
  PARSING = "parsing",
  VALIDATION = "validation",
  TIMEOUT = "timeout",
  RATE_LIMIT = "rate_limit",
  UNKNOWN = "unknown",
}

/**
 * Enhanced scraping error with categorization
 */
export interface CategorizedScrapingError extends ScrapingError {
  category: ErrorCategory;
  retryable: boolean;
  severity: "low" | "medium" | "high";
}

/**
 * Error handling utility for scraping operations
 */
export class ErrorHandler {
  private static readonly RETRY_DELAYS = [1000, 2000, 5000, 10000]; // Exponential backoff delays
  private static readonly MAX_RETRIES = 3;

  /**
   * Categorize and enhance a scraping error
   */
  static categorizeError(
    error: Error | any,
    url?: string,
  ): CategorizedScrapingError {
    const baseError: ScrapingError = {
      message: error instanceof Error ? error.message : String(error),
      url,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date(),
    };

    let category = ErrorCategory.UNKNOWN;
    let retryable = false;
    let severity: "low" | "medium" | "high" = "medium";

    // Categorize based on error message and type
    if (this.isNetworkError(error)) {
      category = ErrorCategory.NETWORK;
      retryable = true;
      severity = "high";
    } else if (this.isTimeoutError(error)) {
      category = ErrorCategory.TIMEOUT;
      retryable = true;
      severity = "medium";
    } else if (this.isRateLimitError(error)) {
      category = ErrorCategory.RATE_LIMIT;
      retryable = true;
      severity = "high";
    } else if (this.isParsingError(error)) {
      category = ErrorCategory.PARSING;
      retryable = false;
      severity = "low";
    } else if (this.isValidationError(error)) {
      category = ErrorCategory.VALIDATION;
      retryable = false;
      severity = "low";
    }

    return {
      ...baseError,
      category,
      retryable,
      severity,
    };
  }

  /**
   * Check if error is network-related
   */
  private static isNetworkError(error: any): boolean {
    const networkErrorCodes = [
      "ECONNREFUSED",
      "ENOTFOUND",
      "ECONNRESET",
      "ETIMEDOUT",
    ];
    const networkErrorMessages = [
      "network error",
      "connection failed",
      "dns lookup failed",
    ];

    if (error.code && networkErrorCodes.includes(error.code)) {
      return true;
    }

    const message = (error.message || "").toLowerCase();
    return networkErrorMessages.some((msg) => message.includes(msg));
  }

  /**
   * Check if error is timeout-related
   */
  private static isTimeoutError(error: any): boolean {
    const timeoutCodes = ["ETIMEDOUT", "ESOCKETTIMEDOUT"];
    const timeoutMessages = ["timeout", "timed out"];

    if (error.code && timeoutCodes.includes(error.code)) {
      return true;
    }

    const message = (error.message || "").toLowerCase();
    return timeoutMessages.some((msg) => message.includes(msg));
  }

  /**
   * Check if error is rate limiting related
   */
  private static isRateLimitError(error: any): boolean {
    const rateLimitMessages = [
      "rate limit",
      "too many requests",
      "429",
      "throttled",
    ];
    const message = (error.message || "").toLowerCase();

    return (
      rateLimitMessages.some((msg) => message.includes(msg)) ||
      (error.response && error.response.status === 429)
    );
  }

  /**
   * Check if error is parsing-related
   */
  private static isParsingError(error: any): boolean {
    const parsingMessages = [
      "parsing error",
      "invalid html",
      "selector not found",
      "cheerio",
    ];
    const message = (error.message || "").toLowerCase();

    return parsingMessages.some((msg) => message.includes(msg));
  }

  /**
   * Check if error is validation-related
   */
  private static isValidationError(error: any): boolean {
    const validationMessages = [
      "validation error",
      "invalid data",
      "missing required",
      "invalid format",
    ];
    const message = (error.message || "").toLowerCase();

    return validationMessages.some((msg) => message.includes(msg));
  }

  /**
   * Execute operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.MAX_RETRIES,
    delays: number[] = this.RETRY_DELAYS,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const categorizedError = this.categorizeError(error);

        // Don't retry if error is not retryable
        if (!categorizedError.retryable || attempt === maxRetries) {
          throw error;
        }

        // Wait before retrying
        const delay = delays[Math.min(attempt, delays.length - 1)];
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log error with appropriate level
   */
  static logError(
    error: CategorizedScrapingError,
    logger: (message: string, level?: "info" | "warn" | "error") => void,
  ): void {
    const logLevel = this.getLogLevel(error.severity);
    const message = `[${error.category.toUpperCase()}] ${error.message}${error.url ? ` (URL: ${error.url})` : ""}`;

    logger(message, logLevel);

    // Log stack trace for high severity errors
    if (error.severity === "high" && error.stack) {
      logger(`Stack trace: ${error.stack}`, "error");
    }
  }

  /**
   * Get appropriate log level for error severity
   */
  private static getLogLevel(
    severity: "low" | "medium" | "high",
  ): "info" | "warn" | "error" {
    switch (severity) {
      case "low":
        return "info";
      case "medium":
        return "warn";
      case "high":
        return "error";
      default:
        return "warn";
    }
  }

  /**
   * Create error summary for multiple errors
   */
  static createErrorSummary(errors: CategorizedScrapingError[]): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<"low" | "medium" | "high", number>;
    retryableCount: number;
  } {
    const summary = {
      total: errors.length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySeverity: { low: 0, medium: 0, high: 0 },
      retryableCount: 0,
    };

    // Initialize category counts
    Object.values(ErrorCategory).forEach((category) => {
      summary.byCategory[category] = 0;
    });

    // Count errors by category and severity
    errors.forEach((error) => {
      summary.byCategory[error.category]++;
      summary.bySeverity[error.severity]++;
      if (error.retryable) {
        summary.retryableCount++;
      }
    });

    return summary;
  }

  /**
   * Determine if scraping should continue based on error analysis
   */
  static shouldContinueScraping(errors: CategorizedScrapingError[]): boolean {
    const summary = this.createErrorSummary(errors);

    // Stop if too many high severity errors
    if (summary.bySeverity.high > 5) {
      return false;
    }

    // Stop if too many network errors (might indicate connectivity issues)
    if (summary.byCategory[ErrorCategory.NETWORK] > 10) {
      return false;
    }

    // Continue for parsing and validation errors (site-specific issues)
    return true;
  }
}

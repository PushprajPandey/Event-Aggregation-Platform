import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types";
import { config } from "../config/environment";

/**
 * Enhanced error tracking for monitoring
 */
interface ErrorMetrics {
  count: number;
  lastOccurred: Date;
  errorType: string;
  statusCode: number;
}

class ErrorTracker {
  private static instance: ErrorTracker;
  private errorCounts: Map<string, ErrorMetrics> = new Map();
  private recentErrors: Array<{
    timestamp: Date;
    error: string;
    url: string;
    method: string;
    statusCode: number;
    userAgent?: string;
    ip?: string;
  }> = [];
  private readonly MAX_RECENT_ERRORS = 100;

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  trackError(
    error: Error,
    req: Request,
    statusCode: number,
    errorType: string,
  ): void {
    const errorKey = `${errorType}:${error.message}`;
    const existing = this.errorCounts.get(errorKey);

    if (existing) {
      existing.count++;
      existing.lastOccurred = new Date();
    } else {
      this.errorCounts.set(errorKey, {
        count: 1,
        lastOccurred: new Date(),
        errorType,
        statusCode,
      });
    }

    // Track recent errors for monitoring
    this.recentErrors.unshift({
      timestamp: new Date(),
      error: error.message,
      url: req.url,
      method: req.method,
      statusCode,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });

    // Keep only recent errors
    if (this.recentErrors.length > this.MAX_RECENT_ERRORS) {
      this.recentErrors = this.recentErrors.slice(0, this.MAX_RECENT_ERRORS);
    }
  }

  getErrorMetrics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: Array<{ error: string; timestamp: Date; context?: any }>;
    topErrors: Array<{ error: string; count: number; lastOccurred: Date }>;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (sum, metric) => sum + metric.count,
      0,
    );

    const errorsByType: Record<string, number> = {};
    const topErrors: Array<{
      error: string;
      count: number;
      lastOccurred: Date;
    }> = [];

    this.errorCounts.forEach((metric, errorKey) => {
      if (!errorsByType[metric.errorType]) {
        errorsByType[metric.errorType] = 0;
      }
      errorsByType[metric.errorType] += metric.count;

      topErrors.push({
        error: errorKey,
        count: metric.count,
        lastOccurred: metric.lastOccurred,
      });
    });

    // Sort top errors by count
    topErrors.sort((a, b) => b.count - a.count);

    return {
      totalErrors,
      errorsByType,
      recentErrors: this.recentErrors.slice(0, 10), // Return only 10 most recent
      topErrors: topErrors.slice(0, 10), // Return top 10 errors
    };
  }

  clearMetrics(): void {
    this.errorCounts.clear();
    this.recentErrors = [];
  }
}

/**
 * Global error handling middleware
 * Catches all errors and returns consistent API responses
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const errorTracker = ErrorTracker.getInstance();

  // Enhanced error logging
  const errorContext = {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    body: req.method !== "GET" ? req.body : undefined,
    query: req.query,
  };

  console.error("Error occurred:", errorContext);

  // Handle specific error types
  let statusCode = 500;
  let errorMessage = "Internal server error";
  let errorType = "INTERNAL_ERROR";

  // MongoDB validation errors
  if (error.name === "ValidationError") {
    statusCode = 400;
    errorMessage = error.message;
    errorType = "VALIDATION_ERROR";
  }

  // MongoDB cast errors (invalid ObjectId)
  if (error.name === "CastError") {
    statusCode = 400;
    errorMessage = "Invalid ID format";
    errorType = "CAST_ERROR";
  }

  // MongoDB duplicate key errors
  if ((error as any).code === 11000) {
    statusCode = 409;
    errorMessage = "Duplicate entry";
    errorType = "DUPLICATE_KEY_ERROR";
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    errorMessage = "Invalid token";
    errorType = "JWT_ERROR";
  }

  if (error.name === "TokenExpiredError") {
    statusCode = 401;
    errorMessage = "Token expired";
    errorType = "JWT_EXPIRED_ERROR";
  }

  // Network and timeout errors
  if (
    error.message.includes("timeout") ||
    error.message.includes("ETIMEDOUT")
  ) {
    statusCode = 504;
    errorMessage = "Request timeout";
    errorType = "TIMEOUT_ERROR";
  }

  // Database connection errors
  if (
    error.message.includes("connection") ||
    error.message.includes("ECONNREFUSED")
  ) {
    statusCode = 503;
    errorMessage = "Service temporarily unavailable";
    errorType = "CONNECTION_ERROR";
  }

  // Rate limiting errors
  if (
    error.message.includes("rate limit") ||
    error.message.includes("Too Many Requests")
  ) {
    statusCode = 429;
    errorMessage = "Too many requests";
    errorType = "RATE_LIMIT_ERROR";
  }

  // Track error for monitoring
  errorTracker.trackError(error, req, statusCode, errorType);

  // Don't expose internal error details in production
  if (config.server.nodeEnv === "production" && statusCode === 500) {
    errorMessage = "Internal server error";
  } else if (config.server.nodeEnv !== "production") {
    errorMessage = error.message;
  }

  const response: ApiResponse = {
    success: false,
    error: errorMessage,
    ...(config.server.nodeEnv !== "production" && {
      details: {
        type: errorType,
        timestamp: new Date().toISOString(),
      },
    }),
  };

  res.status(statusCode).json(response);
}

/**
 * Circuit breaker for external service calls
 */
class ServiceCircuitBreaker {
  private static instances: Map<string, ServiceCircuitBreaker> = new Map();
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private serviceName: string,
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 1 minute
  ) {}

  static getInstance(serviceName: string): ServiceCircuitBreaker {
    if (!ServiceCircuitBreaker.instances.has(serviceName)) {
      ServiceCircuitBreaker.instances.set(
        serviceName,
        new ServiceCircuitBreaker(serviceName),
      );
    }
    return ServiceCircuitBreaker.instances.get(serviceName)!;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeout) {
        this.state = "HALF_OPEN";
        console.log(
          `Circuit breaker for ${this.serviceName} transitioning to HALF_OPEN`,
        );
      } else {
        throw new Error(
          `Service ${this.serviceName} is currently unavailable (circuit breaker OPEN)`,
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      console.log(
        `Circuit breaker for ${this.serviceName} transitioning to CLOSED`,
      );
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN" || this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      console.log(
        `Circuit breaker for ${this.serviceName} transitioning to OPEN`,
      );
    }
  }

  getStatus() {
    return {
      serviceName: this.serviceName,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      isHealthy: this.state === "CLOSED",
    };
  }

  static getAllStatuses() {
    const statuses: any[] = [];
    ServiceCircuitBreaker.instances.forEach((breaker) => {
      statuses.push(breaker.getStatus());
    });
    return statuses;
  }
}

/**
 * Resilience middleware for handling service degradation
 */
export function resilienceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Add resilience context to request
  (req as any).resilience = {
    circuitBreaker: ServiceCircuitBreaker.getInstance,
    isServiceHealthy: (serviceName: string) => {
      const breaker = ServiceCircuitBreaker.getInstance(serviceName);
      return breaker.getStatus().isHealthy;
    },
  };

  next();
}

/**
 * Export error tracker and circuit breaker for health monitoring
 */
export { ErrorTracker, ServiceCircuitBreaker };

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const response: ApiResponse = {
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  };

  res.status(404).json(response);
}

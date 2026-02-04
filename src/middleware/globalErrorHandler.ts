import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types";
import { config } from "../config/environment";
import { ErrorTracker, ServiceCircuitBreaker } from "./errorHandler";

/**
 * Global error categories for better error handling
 */
export enum GlobalErrorCategory {
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  NOT_FOUND = "not_found",
  RATE_LIMIT = "rate_limit",
  DATABASE = "database",
  EXTERNAL_SERVICE = "external_service",
  INTERNAL = "internal",
  NETWORK = "network",
  TIMEOUT = "timeout",
  SCRAPER = "scraper",
}

/**
 * Enhanced error interface with recovery suggestions
 */
export interface EnhancedError extends Error {
  statusCode?: number;
  category?: GlobalErrorCategory;
  isOperational?: boolean;
  context?: Record<string, any>;
  recoverySuggestions?: string[];
  userMessage?: string;
}

/**
 * System degradation levels for graceful degradation
 */
export enum DegradationLevel {
  NONE = "none",
  MINOR = "minor",
  MODERATE = "moderate",
  SEVERE = "severe",
}

/**
 * System degradation manager for handling service failures gracefully
 */
class SystemDegradationManager {
  private static instance: SystemDegradationManager;
  private degradationLevel: DegradationLevel = DegradationLevel.NONE;
  private degradedServices: Set<string> = new Set();
  private lastDegradationCheck: Date = new Date();

  static getInstance(): SystemDegradationManager {
    if (!SystemDegradationManager.instance) {
      SystemDegradationManager.instance = new SystemDegradationManager();
    }
    return SystemDegradationManager.instance;
  }

  /**
   * Report service degradation
   */
  reportServiceDegradation(
    serviceName: string,
    severity: DegradationLevel,
  ): void {
    this.degradedServices.add(serviceName);
    this.updateDegradationLevel();
    this.lastDegradationCheck = new Date();

    console.warn(`Service degradation reported: ${serviceName} (${severity})`);
  }

  /**
   * Report service recovery
   */
  reportServiceRecovery(serviceName: string): void {
    this.degradedServices.delete(serviceName);
    this.updateDegradationLevel();
    this.lastDegradationCheck = new Date();

    console.info(`Service recovery reported: ${serviceName}`);
  }

  /**
   * Update overall system degradation level
   */
  private updateDegradationLevel(): void {
    const serviceCount = this.degradedServices.size;

    if (serviceCount === 0) {
      this.degradationLevel = DegradationLevel.NONE;
    } else if (serviceCount <= 2) {
      this.degradationLevel = DegradationLevel.MINOR;
    } else if (serviceCount <= 4) {
      this.degradationLevel = DegradationLevel.MODERATE;
    } else {
      this.degradationLevel = DegradationLevel.SEVERE;
    }
  }

  /**
   * Get current system status
   */
  getSystemStatus() {
    return {
      degradationLevel: this.degradationLevel,
      degradedServices: Array.from(this.degradedServices),
      isHealthy: this.degradationLevel === DegradationLevel.NONE,
      lastCheck: this.lastDegradationCheck,
    };
  }

  /**
   * Check if a service is degraded
   */
  isServiceDegraded(serviceName: string): boolean {
    return this.degradedServices.has(serviceName);
  }

  /**
   * Get fallback response for degraded services
   */
  getFallbackResponse(serviceName: string): ApiResponse {
    return {
      success: false,
      error: `Service ${serviceName} is temporarily unavailable`,
      data: {
        degradationLevel: this.degradationLevel,
        fallbackMode: true,
        retryAfter: 60, // seconds
      },
    };
  }
}

/**
 * Enhanced global error handler with degradation management
 */
export function enhancedGlobalErrorHandler(
  error: EnhancedError,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const errorTracker = ErrorTracker.getInstance();
  const degradationManager = SystemDegradationManager.getInstance();

  // Enhanced error context
  const errorContext = {
    message: error.message,
    stack: error.stack,
    category: error.category || GlobalErrorCategory.INTERNAL,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    body: req.method !== "GET" ? req.body : undefined,
    query: req.query,
    isOperational: error.isOperational || false,
    context: error.context || {},
  };

  console.error("Enhanced error occurred:", errorContext);

  // Determine status code and user message
  let statusCode = error.statusCode || 500;
  let userMessage = error.userMessage || "An unexpected error occurred";
  let recoverySuggestions = error.recoverySuggestions || [];

  // Handle specific error categories
  switch (error.category) {
    case GlobalErrorCategory.SCRAPER:
      // Scraper errors should not affect public API
      degradationManager.reportServiceDegradation(
        "scraper",
        DegradationLevel.MINOR,
      );
      statusCode = 503;
      userMessage = "Event data is temporarily unavailable";
      recoverySuggestions = [
        "Try refreshing the page in a few minutes",
        "Check our status page for updates",
      ];
      break;

    case GlobalErrorCategory.DATABASE:
      degradationManager.reportServiceDegradation(
        "database",
        DegradationLevel.SEVERE,
      );
      statusCode = 503;
      userMessage = "Service temporarily unavailable";
      recoverySuggestions = [
        "Please try again in a few minutes",
        "Contact support if the issue persists",
      ];
      break;

    case GlobalErrorCategory.EXTERNAL_SERVICE:
      degradationManager.reportServiceDegradation(
        "external",
        DegradationLevel.MODERATE,
      );
      statusCode = 502;
      userMessage = "External service unavailable";
      recoverySuggestions = ["Try again later", "Some features may be limited"];
      break;

    case GlobalErrorCategory.VALIDATION:
      statusCode = 400;
      userMessage = error.message;
      break;

    case GlobalErrorCategory.AUTHENTICATION:
      statusCode = 401;
      userMessage = "Authentication required";
      recoverySuggestions = ["Please log in and try again"];
      break;

    case GlobalErrorCategory.AUTHORIZATION:
      statusCode = 403;
      userMessage = "Access denied";
      break;

    case GlobalErrorCategory.NOT_FOUND:
      statusCode = 404;
      userMessage = "Resource not found";
      break;

    case GlobalErrorCategory.RATE_LIMIT:
      statusCode = 429;
      userMessage = "Too many requests";
      recoverySuggestions = ["Please wait before trying again"];
      break;

    case GlobalErrorCategory.TIMEOUT:
      statusCode = 504;
      userMessage = "Request timeout";
      recoverySuggestions = ["Try again with a simpler request"];
      break;
  }

  // Track error for monitoring
  errorTracker.trackError(error, req, statusCode, error.category || "UNKNOWN");

  // Build response
  const response: ApiResponse = {
    success: false,
    error: userMessage,
    data: {
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...(recoverySuggestions.length > 0 && { recoverySuggestions }),
      ...(config.server.nodeEnv !== "production" && {
        details: {
          category: error.category,
          isOperational: error.isOperational,
          context: error.context,
        },
      }),
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Middleware to check system degradation and provide fallback responses
 */
export function systemDegradationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const degradationManager = SystemDegradationManager.getInstance();
  const systemStatus = degradationManager.getSystemStatus();

  // Add system status to request context
  (req as any).systemStatus = systemStatus;

  // For severe degradation, return maintenance mode for non-essential endpoints
  if (systemStatus.degradationLevel === DegradationLevel.SEVERE) {
    // Allow health checks and essential endpoints
    const essentialPaths = ["/health", "/auth", "/api/events"];
    const isEssentialPath = essentialPaths.some((path) =>
      req.path.startsWith(path),
    );

    if (!isEssentialPath) {
      res.status(503).json({
        success: false,
        error: "System is under maintenance",
        data: {
          degradationLevel: systemStatus.degradationLevel,
          maintenanceMode: true,
          retryAfter: 300, // 5 minutes
        },
      });
      return;
    }
  }

  next();
}

/**
 * Create enhanced error with category and context
 */
export function createEnhancedError(
  message: string,
  category: GlobalErrorCategory,
  statusCode?: number,
  context?: Record<string, any>,
  recoverySuggestions?: string[],
): EnhancedError {
  const error = new Error(message) as EnhancedError;
  error.category = category;
  error.statusCode = statusCode;
  error.context = context;
  error.recoverySuggestions = recoverySuggestions;
  error.isOperational = true;
  return error;
}

export { SystemDegradationManager };

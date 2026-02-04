import { Request, Response, NextFunction } from "express";
import { config } from "../config/environment";

/**
 * Custom request logging middleware
 * Logs API requests with relevant information
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();

  // Log request details
  const requestInfo = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  };

  // Only log in development or if explicitly enabled
  if (config.server.nodeEnv === "development") {
    console.log("📥 Incoming request:", requestInfo);
  }

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (body: any) {
    const duration = Date.now() - startTime;

    const responseInfo = {
      ...requestInfo,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: body?.success || false,
    };

    // Log response details
    if (config.server.nodeEnv === "development") {
      console.log("📤 Response sent:", responseInfo);
    }

    // Log errors and slow requests in production
    if (config.server.nodeEnv === "production") {
      if (res.statusCode >= 400 || duration > 5000) {
        console.log("⚠️  Request issue:", responseInfo);
      }
    }

    return originalJson.call(this, body);
  };

  next();
}

/**
 * Rate limiting information middleware
 * Adds rate limiting headers (placeholder for future implementation)
 */
export function rateLimitInfo(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Add rate limiting headers
  res.set({
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "99",
    "X-RateLimit-Reset": new Date(Date.now() + 60000).toISOString(),
  });

  next();
}

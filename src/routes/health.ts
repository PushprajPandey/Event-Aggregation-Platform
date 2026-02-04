import { Router, Request, Response } from "express";
import { database } from "../config/database";
import { ErrorTracker } from "../middleware/errorHandler";
import { ApiResponse } from "../types";
import { ScrapingLog } from "../models/ScrapingLog";
import { Event } from "../models/Event";

const router = Router();

/**
 * Basic health check endpoint
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const response: ApiResponse = {
      success: true,
      message: "Sydney Events Aggregator API is running",
      data: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0",
        uptime: Math.floor(process.uptime()),
        status: "healthy",
      },
    };
    res.json(response);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: "Health check failed",
      data: {
        timestamp: new Date().toISOString(),
        status: "unhealthy",
      },
    });
  }
});

/**
 * Detailed system health check
 */
router.get("/detailed", async (req: Request, res: Response) => {
  const healthChecks = {
    database: false,
    scraping: false,
    errors: false,
    memory: false,
  };

  const details: any = {
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
  };

  try {
    // Database health check
    healthChecks.database = database.getConnectionStatus();
    details.database = {
      connected: healthChecks.database,
      readyState: require("mongoose").connection.readyState,
    };

    // Scraping system health check
    try {
      const recentLogs = await ScrapingLog.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const recentSuccessfulScrapes = recentLogs.filter(
        (log) => log.status === "completed",
      ).length;

      healthChecks.scraping = recentSuccessfulScrapes > 0;
      details.scraping = {
        recentLogs: recentLogs.length,
        recentSuccessful: recentSuccessfulScrapes,
        lastScrapeTime: recentLogs[0]?.createdAt || null,
      };
    } catch (error) {
      details.scraping = {
        error: "Failed to check scraping status",
      };
    }

    // Error tracking health check
    const errorTracker = ErrorTracker.getInstance();
    const errorMetrics = errorTracker.getErrorMetrics();

    // Consider healthy if error rate is low
    const recentErrorCount = errorMetrics.recentErrors.filter(
      (error) =>
        new Date().getTime() - error.timestamp.getTime() < 60 * 60 * 1000, // Last hour
    ).length;

    healthChecks.errors = recentErrorCount < 10; // Less than 10 errors in last hour
    details.errors = {
      totalErrors: errorMetrics.totalErrors,
      recentErrorsLastHour: recentErrorCount,
      errorsByType: errorMetrics.errorsByType,
    };

    // Memory health check
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };

    // Consider healthy if heap usage is less than 80% of total
    healthChecks.memory =
      memoryUsageMB.heapUsed < memoryUsageMB.heapTotal * 0.8;
    details.memory = memoryUsageMB;

    // Overall health status
    const overallHealth = Object.values(healthChecks).every(Boolean);
    const statusCode = overallHealth ? 200 : 503;

    const response: ApiResponse = {
      success: overallHealth,
      message: overallHealth ? "All systems healthy" : "Some systems unhealthy",
      data: {
        ...details,
        status: overallHealth ? "healthy" : "degraded",
        checks: healthChecks,
      },
    };

    res.status(statusCode).json(response);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: "Health check failed",
      data: {
        timestamp: new Date().toISOString(),
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
});

/**
 * System metrics endpoint
 */
router.get("/metrics", async (req: Request, res: Response) => {
  try {
    const errorTracker = ErrorTracker.getInstance();
    const errorMetrics = errorTracker.getErrorMetrics();

    // Get event statistics
    const eventStats = await Event.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get scraping statistics
    const scrapingStats = await ScrapingLog.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalEvents: { $sum: "$eventsProcessed" },
        },
      },
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        errors: errorMetrics,
        events: eventStats.reduce(
          (acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        scraping: scrapingStats.reduce(
          (acc, stat) => {
            acc[stat._id] = {
              count: stat.count,
              totalEvents: stat.totalEvents,
            };
            return acc;
          },
          {} as Record<string, any>,
        ),
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve metrics",
    });
  }
});

/**
 * Readiness probe for Kubernetes/container orchestration
 */
router.get("/ready", async (req: Request, res: Response) => {
  try {
    // Check if database is ready
    const dbReady = database.getConnectionStatus();

    if (!dbReady) {
      return res.status(503).json({
        success: false,
        error: "Database not ready",
        data: { ready: false },
      });
    }

    return res.json({
      success: true,
      data: { ready: true, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: "Readiness check failed",
      data: { ready: false },
    });
  }
});

/**
 * Liveness probe for Kubernetes/container orchestration
 */
router.get("/live", (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    success: true,
    data: {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    },
  });
});

/**
 * System status endpoint for frontend status banner
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const { SystemDegradationManager } =
      await import("../middleware/globalErrorHandler");
    const degradationManager = SystemDegradationManager.getInstance();
    const systemStatus = degradationManager.getSystemStatus();

    // Check scraper health
    let scraperStatus: "healthy" | "degraded" = "healthy";
    try {
      const recentLogs = await ScrapingLog.find()
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      const recentFailures = recentLogs.filter(
        (log) => log.status === "failed",
      ).length;
      if (recentFailures > 1) {
        scraperStatus = "degraded";
      }
    } catch (error) {
      scraperStatus = "degraded";
    }

    // Check cache status (simplified - based on recent data)
    let cacheStatus: "available" | "stale" = "available";
    try {
      const recentEvents = await Event.countDocuments({
        lastScrapedAt: {
          $gte: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
        },
      });

      if (recentEvents === 0) {
        cacheStatus = "stale";
      }
    } catch (error) {
      cacheStatus = "stale";
    }

    // Generate recommendations based on system state
    const recommendations: string[] = [];

    if (systemStatus.degradationLevel === "severe") {
      recommendations.push("Multiple services are experiencing issues");
      recommendations.push("Some features may be temporarily unavailable");
    } else if (systemStatus.degradationLevel === "moderate") {
      recommendations.push(
        "Some services are running with limited functionality",
      );
      recommendations.push("Event data may be delayed");
    } else if (systemStatus.degradationLevel === "minor") {
      recommendations.push("Minor service issues detected");
      recommendations.push("Most features are working normally");
    }

    if (scraperStatus === "degraded") {
      recommendations.push("Event data updates may be delayed");
    }

    if (cacheStatus === "stale") {
      recommendations.push("Displaying cached event data");
    }

    const statusInfo = {
      status: systemStatus.isHealthy ? "healthy" : "degraded",
      degradationLevel: systemStatus.degradationLevel,
      services: {
        scraper: scraperStatus,
        cache: cacheStatus,
      },
      lastUpdate: new Date().toISOString(),
      recommendations,
    };

    const response: ApiResponse = {
      success: true,
      message: "System status retrieved",
      data: statusInfo,
    };

    res.json(response);
  } catch (error) {
    console.error("System status check failed:", error);

    const response: ApiResponse = {
      success: false,
      error: "Failed to retrieve system status",
      data: {
        status: "degraded",
        degradationLevel: "moderate",
        services: {
          scraper: "degraded",
          cache: "stale",
        },
        lastUpdate: new Date().toISOString(),
        recommendations: [
          "System status check failed",
          "Some features may be limited",
        ],
      },
    };

    res.status(503).json(response);
  }
});

export { router as healthRouter };

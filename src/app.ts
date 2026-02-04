import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import session from "express-session";
import { config } from "./config/environment";
import { passport } from "./config/passport";
import { database } from "./config/database";
import { ApiResponse } from "./types";
import { apiRouter, authRouter } from "./routes";
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  rateLimitInfo,
  resilienceMiddleware,
} from "./middleware";
import {
  enhancedGlobalErrorHandler,
  systemDegradationMiddleware,
  SystemDegradationManager,
} from "./middleware/globalErrorHandler";

export function createApp(): Application {
  const app: Application = express();

  // Trust proxy for accurate IP addresses (important for rate limiting and logging)
  app.set("trust proxy", 1);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }),
  );

  // CORS configuration for frontend integration
  app.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          config.cors.frontendUrl
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      exposedHeaders: [
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "X-System-Status",
        "X-Degradation-Level",
      ],
    }),
  );

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Session configuration
  app.use(
    session({
      secret: config.auth.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.server.nodeEnv === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: config.server.nodeEnv === "production" ? "strict" : "lax",
      },
    }),
  );

  // Initialize Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Request logging middleware
  app.use(requestLogger);

  // System degradation middleware (before resilience middleware)
  app.use(systemDegradationMiddleware);

  // Resilience middleware for handling service degradation
  app.use(resilienceMiddleware);

  // Rate limiting information (placeholder headers)
  app.use(rateLimitInfo);

  // Morgan logging (only in development, as we have custom logging)
  if (config.server.nodeEnv === "development") {
    app.use(morgan("dev"));
  }

  // Add system status headers to all responses
  app.use((req: Request, res: Response, next) => {
    const degradationManager = SystemDegradationManager.getInstance();
    const systemStatus = degradationManager.getSystemStatus();

    res.setHeader(
      "X-System-Status",
      systemStatus.isHealthy ? "healthy" : "degraded",
    );
    res.setHeader("X-Degradation-Level", systemStatus.degradationLevel);

    next();
  });

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    const degradationManager = SystemDegradationManager.getInstance();
    const systemStatus = degradationManager.getSystemStatus();

    const response: ApiResponse = {
      success: systemStatus.isHealthy,
      message: systemStatus.isHealthy
        ? "Sydney Events Aggregator API is running"
        : "Sydney Events Aggregator API is running with degraded services",
      data: {
        timestamp: new Date().toISOString(),
        environment: config.server.nodeEnv,
        version: "1.0.0",
        uptime: process.uptime(),
        systemStatus,
      },
    };

    const statusCode = systemStatus.isHealthy ? 200 : 503;
    res.status(statusCode).json(response);
  });

  // API health check endpoint for deployment monitoring
  app.get("/api/health", (req: Request, res: Response) => {
    const degradationManager = SystemDegradationManager.getInstance();
    const systemStatus = degradationManager.getSystemStatus();

    const response: ApiResponse = {
      success: systemStatus.isHealthy,
      message: systemStatus.isHealthy
        ? "API is healthy"
        : "API is running with degraded services",
      data: {
        timestamp: new Date().toISOString(),
        environment: config.server.nodeEnv,
        version: "1.0.0",
        uptime: process.uptime(),
        systemStatus,
      },
    };

    const statusCode = systemStatus.isHealthy ? 200 : 503;
    res.status(statusCode).json(response);
  });

  // Comprehensive system health monitoring endpoints
  app.get("/health/detailed", async (req: Request, res: Response) => {
    try {
      const { ErrorTracker, ServiceCircuitBreaker } =
        await import("./middleware/errorHandler");
      const errorTracker = ErrorTracker.getInstance();
      const errorMetrics = errorTracker.getErrorMetrics();
      const circuitBreakerStatuses = ServiceCircuitBreaker.getAllStatuses();
      const degradationManager = SystemDegradationManager.getInstance();
      const systemStatus = degradationManager.getSystemStatus();

      // Check database connectivity
      let dbStatus = "healthy";
      let dbLatency = 0;
      try {
        const startTime = Date.now();
        const isConnected = database.getConnectionStatus();
        if (!isConnected) {
          throw new Error("Database not connected");
        }
        dbLatency = Date.now() - startTime;
      } catch (error) {
        dbStatus = "unhealthy";
        degradationManager.reportServiceDegradation(
          "database",
          "severe" as any,
        );
        console.error("Database health check failed:", error);
      }

      // Memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      };

      // CPU usage (approximation)
      const cpuUsage = process.cpuUsage();

      const healthData = {
        status: systemStatus.isHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.server.nodeEnv,
        version: "1.0.0",
        systemStatus,
        database: {
          status: dbStatus,
          latency: `${dbLatency}ms`,
        },
        memory: memoryUsageMB,
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        errors: errorMetrics,
        services: circuitBreakerStatuses,
        nodeVersion: process.version,
        platform: process.platform,
      };

      const response: ApiResponse = {
        success: systemStatus.isHealthy,
        message: "Detailed system health information",
        data: healthData,
      };

      const statusCode = systemStatus.isHealthy ? 200 : 503;
      res.status(statusCode).json(response);
    } catch (error) {
      console.error("Health check error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Health check failed",
        data: {
          timestamp: new Date().toISOString(),
          status: "unhealthy",
        },
      };
      res.status(503).json(response);
    }
  });

  // Readiness probe for Kubernetes/container orchestration
  app.get("/health/ready", async (req: Request, res: Response) => {
    try {
      // Check if database is ready
      const dbReady = database.getConnectionStatus();
      if (!dbReady) {
        throw new Error("Database not ready");
      }

      const response: ApiResponse = {
        success: true,
        message: "Service is ready",
        data: {
          timestamp: new Date().toISOString(),
          ready: true,
        },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: "Service not ready",
        data: {
          timestamp: new Date().toISOString(),
          ready: false,
        },
      };
      res.status(503).json(response);
    }
  });

  // Liveness probe for Kubernetes/container orchestration
  app.get("/health/live", (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      message: "Service is alive",
      data: {
        timestamp: new Date().toISOString(),
        alive: true,
        uptime: process.uptime(),
      },
    };
    res.json(response);
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    // Close server
    const server = app.listen();
    server?.close(() => {
      console.log("HTTP server closed.");

      // Close database connection
      database
        .disconnect()
        .then(() => {
          console.log("Database connection closed.");
          process.exit(0);
        })
        .catch((error) => {
          console.error("Error closing database connection:", error);
          process.exit(1);
        });
    });

    // Force close after timeout
    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down",
      );
      process.exit(1);
    }, 10000);
  };

  // Handle shutdown signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    gracefulShutdown("uncaughtException");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown("unhandledRejection");
  });

  // API routes
  app.use("/api", apiRouter);

  // Authentication routes
  app.use("/auth", authRouter);

  // 404 handler for unmatched routes
  app.use("*", notFoundHandler);

  // Enhanced global error handler (must be last)
  app.use(enhancedGlobalErrorHandler);

  return app;
}
